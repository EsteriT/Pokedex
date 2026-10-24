const MiB = 1024 * 1024;
const rules = {
  catalogue_info: ["public", 1024, 256 * 1024],
  search_catalogue: ["public", 4096, 64 * 1024],
  catalogue_cards: ["public", 16384, 256 * 1024],
  commit_binders: ["write", 8 * MiB, 1024],
  commit_collection: ["write", 18 * MiB, 1024],
  reserve_binder_artwork: ["artwork", 1024, 1024],
  cleanup_binder_artwork: ["account", 1024, 16384],
  account_snapshot: ["account", 1024, 26 * MiB],
  restore_account: ["account", 26 * MiB, 1024],
  begin_account_deletion: ["deletion", 1024, 26 * MiB],
  finish_account_deletion: ["deletion", 1024, 1024],
  report_account_failure: ["telemetry", 1024, 1024],
};
export function route(path, method) {
  const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
  if (rpc && method === "POST" && Object.hasOwn(rules, rpc[1]))
    return rules[rpc[1]];
  if (
    ["GET", "HEAD"].includes(method) &&
    /^\/rest\/v1\/(binders|collections)$/.test(path)
  )
    return [
      "read",
      0,
      method === "HEAD" ? 0 : path.endsWith("/binders") ? 8 * MiB : 18 * MiB,
    ];
  if (
    /^\/storage\/v1\/object\/(authenticated\/)?binder-artwork\/[0-9a-f-]{36}\/[0-9a-f]{64}\.(png|jpg|webp)$/.test(
      path,
    )
  ) {
    if (["GET", "HEAD"].includes(method))
      return ["artwork", 0, method === "HEAD" ? 0 : 500000];
    if (method === "POST" && !path.includes("/authenticated/"))
      return ["artwork", 512000, 4096];
  }
  if (path === "/storage/v1/object/binder-artwork" && method === "DELETE")
    // Up to 60 owned files return object metadata after deletion.
    return ["deletion", 16384, 64 * 1024];
  return null;
}
async function boundedBody(body, limit) {
  if (!body) return undefined;
  const reader = body.getReader(),
    chunks = [];
  let size = 0;
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error("timeout")), 10000);
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), expired]);
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw Error("size");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => {});
  }
}
function limitedStream(body, limit) {
  if (!body) return null;
  const reader = body.getReader();
  let size = 0;
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        size += value.byteLength;
        if (size > limit) throw Error("size");
        controller.enqueue(value);
      } catch {
        await reader.cancel().catch(() => {});
        controller.error(
          Error("Response interrupted. Preserve your draft and retry."),
        );
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
export function createGateway(config, network = fetch) {
  return async function handle(request) {
    const origin = request.headers.get("origin");
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Access-Control-Expose-Headers": "Retry-After, Content-Range",
    });
    if (origin && config.origins.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    }
    const failure = (status, message, retry) => {
      headers.delete("content-length");
      headers.set("content-type", "application/json");
      if (retry) headers.set("Retry-After", String(retry));
      return Response.json(
        { code: status === 429 ? "PXD429" : "PXD_GATEWAY", message },
        { status, headers },
      );
    };
    if (
      !config.url ||
      !config.publicKey ||
      !/^[a-f0-9]{64}$/.test(config.secret || "") ||
      !config.origins.length
    )
      return failure(
        503,
        "Request protection is not configured. Please retry later.",
      );
    if (origin && !config.origins.includes(origin))
      return failure(403, "Origin unavailable.");
    if (request.method === "OPTIONS") {
      headers.set(
        "Access-Control-Allow-Methods",
        "GET, HEAD, POST, DELETE, OPTIONS",
      );
      headers.set(
        "Access-Control-Allow-Headers",
        "apikey, authorization, content-type, x-client-info, prefer, range, range-unit, x-upsert, accept-profile, content-profile, x-pokedex-body-bytes",
      );
      return new Response(null, { status: 204, headers });
    }
    const url = new URL(request.url);
    const path = url.pathname.replace(
      /^\/(functions\/v1\/)?usage-gateway(?=\/)/,
      "",
    );
    const rule = route(path, request.method);
    if (!rule || url.search.length > 2000)
      return failure(404, "Request unavailable.");
    const [category, maxInput, maxOutput] = rule;
    const token = request.headers.get("authorization") || "";
    const authorization =
      /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
        ? token
        : "Bearer " + config.publicKey;
    const upstreamHeaders = new Headers({
      apikey: config.publicKey,
      Authorization: authorization,
      "x-pokedex-gateway": config.secret,
      "Content-Type": "application/json",
    });
    try {
      // A size hint is a checked upper bound, never authority to send more.
      // Verify admission BEFORE buffering private uploads, including forged JWTs.
      const hint =
        request.headers.get("x-pokedex-body-bytes") ??
        request.headers.get("content-length");
      const declared = hint === null ? maxInput : Number(hint);
      const invalidSize =
        !Number.isSafeInteger(declared) || declared < 0 || declared > maxInput;
      const inputLimit = invalidSize ? maxInput : declared;
      // Admission commits before the action: failed validation/transactions
      // cannot undo an attempt. PostgREST verifies the JWT and chooses uid.
      const admission = await network(config.url + "/rest/v1/rpc/admit_usage", {
        method: "POST",
        headers: upstreamHeaders,
        body: JSON.stringify({ category, byte_cost: inputLimit + maxOutput }),
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (!admission.ok) {
        await admission.body?.cancel();
        const auth = admission.status === 401 || admission.status === 403;
        return failure(
          auth ? 401 : 503,
          auth
            ? "Sign in again before continuing."
            : "Request protection is busy. Please retry shortly.",
        );
      }
      const result = JSON.parse(
        new TextDecoder().decode(await boundedBody(admission.body, 1024)),
      );
      if (typeof result.allowed !== "boolean")
        throw Error("Invalid admission response.");
      if (result.allowed !== true) {
        const retry = Math.max(
          1,
          Math.min(60, Math.ceil(Number(result.retry_after) || 60)),
        );
        return failure(
          429,
          `Too many requests. Try again in ${retry} seconds. Your unsaved changes are still here.`,
          retry,
        );
      }
      let body;
      try {
        if (invalidSize) throw Error("size");
        body = await boundedBody(request.body, inputLimit);
      } catch {
        return failure(
          413,
          "This request is too large or was interrupted. Preserve your draft.",
        );
      }
      for (const name of [
        "content-type",
        "accept",
        "range",
        "range-unit",
        "x-upsert",
      ]) {
        const value = request.headers.get(name);
        if (value) upstreamHeaders.set(name, value);
      }
      const prefer = request.headers.get("prefer") || "";
      if (/params\s*=|tx\s*=/i.test(prefer))
        return failure(400, "Batch execution is unavailable.");
      if (prefer) upstreamHeaders.set("prefer", prefer);
      upstreamHeaders.set("Accept-Profile", "public");
      upstreamHeaders.set("Content-Profile", "public");
      const response = await network(config.url + path + url.search, {
        method: request.method,
        headers: upstreamHeaders,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      // Fetch may decompress upstream responses. Do not forward their original
      // Content-Length onto the decoded stream.
      for (const name of ["content-type", "content-range", "retry-after"]) {
        const value = response.headers.get(name);
        if (value) headers.set(name, value);
      }
      if (
        request.method !== "HEAD" &&
        Number(response.headers.get("content-length") || 0) > maxOutput
      ) {
        await response.body?.cancel();
        return failure(
          502,
          "Response exceeds the supported limit. Preserve your draft.",
        );
      }
      return new Response(
        request.method === "HEAD"
          ? null
          : limitedStream(response.body, maxOutput),
        {
          status: response.status,
          headers,
        },
      );
    } catch {
      return failure(
        503,
        "Request interrupted. Preserve your draft and retry.",
      );
    }
  };
}
