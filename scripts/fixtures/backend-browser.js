/* Browser contract fixture only. It never contacts Supabase or real accounts. */
(() => {
  const config = {
    url: "http://127.0.0.1:54321",
    publishableKey: "browser-test",
  };
  const key = "pokedex.test-cloud";
  const read = () => JSON.parse(sessionStorage.getItem(key) || "[]");
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "test@example.com",
  };
  const sdk = {
    auth: {
      async getUser() {
        return { data: { user } };
      },
      onAuthStateChange() {},
      async signOut() {
        return {};
      },
    },
    storage: {
      from() {
        return {};
      },
    },
    from() {
      return {
        select() {
          return {
            async order() {
              return { data: read() };
            },
          };
        },
      };
    },
    async rpc(name, args) {
      if (name === "cleanup_binder_artwork") return { data: [] };
      const rows = read();
      if (
        JSON.stringify(args.expected) !==
        JSON.stringify(rows.map((r) => ({ id: r.id, revision: r.revision })))
      )
        return { error: { code: "40001" } };
      const next = args.documents.map((r, position) => ({
        ...r,
        position,
        revision: (rows.find((old) => old.id === r.id)?.revision || 0) + 1,
      }));
      sessionStorage.setItem(key, JSON.stringify(next));
      return {};
    },
  };
  Object.defineProperty(window, "POKEDEX_BACKEND", {
    get: () => config,
    set() {},
  });
  Object.defineProperty(window, "createSupabaseClient", {
    get: () => () => sdk,
    set() {},
  });
})();
