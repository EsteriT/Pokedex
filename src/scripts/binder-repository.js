/* Cloud records stay in memory. The original local workspace is never migrated
   or overwritten implicitly, and edits still require an explicit Save. */
(() => {
  "use strict";
  const local = window.BinderStore,
    config = window.POKEDEX_BACKEND || {};
  const enabled = !!config.url;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  let client,
    media,
    user = null,
    entries = [],
    failure = null,
    changed = false;
  function assertSession() {
    if (failure) throw failure;
    if (!user || changed)
      throw Error(
        changed
          ? "Account changed. Download your draft backup, then reload."
          : "Sign in with Google to save a cloud binder.",
      );
  }
  function errorFor(error) {
    const result = Error(
      error.code === "40001"
        ? "A newer version was saved elsewhere. Your draft is safe. Reload the saved version or save your draft as a copy."
        : error.message ||
            "Cloud request failed. Your draft has not been saved.",
    );
    result.code = error.code;
    return result;
  }
  async function accessToken() {
    assertSession();
    const { data, error } = await client.auth.getSession();
    assertSession();
    if (error) throw errorFor(error);
    if (!data.session?.access_token || data.session.user.id !== user.id)
      throw Error("Account changed. Download your draft backup, then reload.");
    return data.session.access_token;
  }
  function entry(row) {
    const d = local.validate(row.document),
      first = d.pages[0];
    return {
      id: row.id,
      revision: row.revision,
      name: d.name,
      pages: d.pages.length,
      rows: first.rows,
      columns: first.columns,
      style: "lavender",
      cards: first.regions
        .filter((r) => r.content && !r.content.kind)
        .map((r) => r.content.cardId),
      document: d,
    };
  }
  async function refresh() {
    assertSession();
    const owner = user.id;
    const { data, error } = await client
      .from("binders")
      .select("*")
      .order("position");
    if (error) throw errorFor(error);
    assertSession();
    if (user.id !== owner)
      throw Error("Account changed. Reload before continuing.");
    const next = [];
    for (const row of data)
      next.push(entry({ ...row, document: await media.hydrate(row.document) }));
    assertSession();
    entries = next;
    return clone(entries);
  }
  function materialize(b) {
    const doc = b.document || window.BinderState.create(b).document;
    return local.validate({ ...doc, name: b.name });
  }
  async function write(next, expected = entries) {
    if (!enabled) return local.write(next);
    assertSession();
    const owner = user.id;
    if (next.length > 3) throw Error("All three binder slots are in use.");
    const documents = [];
    for (const b of next)
      documents.push({ id: b.id, document: await media.pack(materialize(b)) });
    assertSession();
    const token = await accessToken();
    const { error } = await client
      .rpc("commit_binders", {
        expected: expected.map((b) => ({ id: b.id, revision: b.revision })),
        documents,
      })
      // Never let an SDK session change retarget an already submitted write.
      .setHeader("Authorization", "Bearer " + token);
    if (error) throw errorFor(error);
    assertSession();
    if (user.id !== owner)
      throw Error("Account changed. Reload before continuing.");
    return refresh();
  }
  async function save(id, doc, revision) {
    if (!enabled) return local.save(id, doc, revision);
    assertSession();
    const latest = await refresh(),
      prior = latest.find((b) => b.id === id);
    if ((prior?.revision ?? null) !== revision)
      throw errorFor({ code: "40001" });
    const next = latest.filter((b) => b.id !== id),
      value = { id, name: doc.name, document: local.validate(doc) };
    if (prior)
      next.splice(
        latest.findIndex((b) => b.id === id),
        0,
        value,
      );
    else next.push(value);
    const result = await write(next, latest);
    return result.find((b) => b.id === id);
  }
  async function initialize() {
    if (!enabled) return;
    try {
      client = window.createSupabaseClient(config.url, config.publishableKey, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
        global: {
          fetch: (url, options = {}) =>
            fetch(url, {
              ...options,
              // Private responses must not survive an account switch in HTTP cache.
              cache: "no-store",
              signal: options.signal || AbortSignal.timeout(20000),
            }),
        },
      });
      const { data, error } = await client.auth.getUser();
      if (error && error.name !== "AuthSessionMissingError")
        throw errorFor(error);
      user = data?.user || null;
      if (user)
        media = window.BinderCloudMedia.create(client, user.id, assertSession);
      client.auth.onAuthStateChange((_event, session) => {
        if ((session?.user?.id || null) !== (user?.id || null)) {
          changed = true;
          entries = [];
          window.dispatchEvent(new Event("pokedex-account-changed"));
        }
      });
      if (user) await refresh();
    } catch (error) {
      failure = error;
    }
  }
  const ready = initialize();
  window.BinderRepository = {
    enabled,
    ready,
    assertSession,
    accessToken,
    get user() {
      return user;
    },
    get client() {
      return client;
    },
    read() {
      if (!enabled) return local.read();
      if (failure) throw failure;
      if (changed) assertSession();
      return clone(entries);
    },
    refresh: () => (enabled ? refresh() : Promise.resolve(local.read())),
    write,
    save,
    async signIn(redirectTo) {
      if (!client) throw failure || Error("Cloud saving is not configured.");
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw errorFor(error);
    },
    async signOut() {
      if (
        window.dispatchEvent(
          new Event("pokedex-before-signout", { cancelable: true }),
        ) === false
      )
        return;
      const { error } = await client.auth.signOut();
      if (error) throw errorFor(error);
      location.reload();
    },
    async cleanupArtwork() {
      assertSession();
      return media.cleanup();
    },
    async importLocal(id) {
      assertSession();
      const source = local.read().find((b) => b.id === id);
      if (!source) throw Error("Local binder no longer available.");
      const latest = await refresh();
      const copy = {
        ...source,
        id: crypto.randomUUID(),
        document: materialize(source),
      };
      await write([...latest, copy], latest);
      return copy.id;
    },
  };
})();
