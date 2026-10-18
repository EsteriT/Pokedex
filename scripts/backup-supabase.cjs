const { maxBytes } = require("./backup-crypto.cjs");
async function readOnlyQuery(sql, ref, token, request = fetch) {
  if (
    !/^[a-z]{20}$/.test(ref) ||
    !token?.startsWith("sbp_fc") ||
    /\s/.test(token)
  )
    throw Error("Use the explicit project and scoped Database Read token.");
  let response;
  try {
    response = await request(
      "https://api.supabase.com/v1/projects/" + ref + "/database/query",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(120000),
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql, read_only: true }),
      },
    );
  } catch {
    throw Object.assign(Error("Supabase read-only request unavailable."), {
      code: "SUPABASE_NETWORK",
    });
  }
  if (!response.ok) {
    await response.body?.cancel();
    const status = [400, 401, 403, 429, 500, 502, 503].includes(response.status)
      ? response.status
      : "FAILED";
    throw Object.assign(Error("Supabase read-only request failed."), {
      code: "SUPABASE_HTTP_" + status,
    });
  }
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxBytes) throw Error();
      chunks.push(chunk);
    }
    const rows = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      !Array.isArray(rows) ||
      rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))
    )
      throw Error();
    return rows;
  } catch {
    throw Object.assign(
      Error(
        "Invalid or oversized Supabase response; private output was not printed.",
      ),
      { code: "SUPABASE_RESPONSE_INVALID" },
    );
  }
}
module.exports = { readOnlyQuery };
