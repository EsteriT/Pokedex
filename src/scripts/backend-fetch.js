/* Opt-in transport only; Auth stays on Supabase's original callback/session URL. */
(() => {
  const config = window.POKEDEX_BACKEND || {};
  window.PokedexFetch = (input, options = {}) => {
    let target = input;
    if (config.usageGateway && config.url) {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (
        url.origin === new URL(config.url).origin &&
        /^\/(rest|storage)\/v1\//.test(url.pathname)
      ) {
        target =
          config.url +
          "/functions/v1/usage-gateway" +
          url.pathname +
          url.search;
        if (input instanceof Request) target = new Request(target, input);
        // This is a checked size hint, not a trusted bypass. Unknown/streamed
        // bodies keep the server maximum; FormData uses its HTTP envelope size.
        const body = options.body;
        const size =
          typeof body === "string"
            ? new TextEncoder().encode(body).byteLength
            : body instanceof ArrayBuffer
              ? body.byteLength
              : ArrayBuffer.isView(body)
                ? body.byteLength
                : body instanceof Blob
                  ? body.size
                  : null;
        if (size !== null) {
          const headers = new Headers(
            options.headers ||
              (input instanceof Request ? input.headers : undefined),
          );
          headers.set("x-pokedex-body-bytes", String(size));
          options = { ...options, headers };
        }
      }
    }
    return fetch(target, { ...options, redirect: "error", cache: "no-store" });
  };
  window.PokedexFetch.error = async (response, fallback) => {
    if (response.status === 429) {
      const seconds = Math.max(
        1,
        Math.min(60, Number(response.headers.get("Retry-After")) || 60),
      );
      const error = Error(
        `Too many requests. Try again in ${Math.ceil(seconds)} seconds. Your unsaved changes are still here.`,
      );
      error.code = "PXD429";
      error.retryAfter = Math.ceil(seconds);
      return error;
    }
    return Error(fallback);
  };
})();
