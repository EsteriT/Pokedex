const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
async function scenario({
  clipboardFails = false,
  logoutFails = false,
  storageFails = false,
  accountChanges = false,
} = {}) {
  const calls = [];
  let changed = false;
  const repo = {
    enabled: true,
    ready: Promise.resolve(),
    identityToken: async () => "owner-token",
    assertIdentity() {
      if (changed) throw Error("Account changed");
    },
    client: {
      rpc(name) {
        calls.push(name);
        const request = Promise.resolve().then(() => {
          if (accountChanges) changed = true;
          return {
            data:
              name === "begin_account_deletion"
                ? { artwork: storageFails ? ["owner/image.png"] : [] }
                : null,
          };
        });
        request.setHeader = (key, value) => {
          assert.equal(key, "Authorization");
          assert.equal(value, "Bearer owner-token");
          return request;
        };
        return request;
      },
      auth: {
        async signOut() {
          calls.push("signOut");
          if (logoutFails) throw Error("Logout network failure");
        },
      },
    },
  };
  const scope = {
    window: {
      BinderRepository: repo,
      POKEDEX_BACKEND: {
        url: "http://127.0.0.1:54321",
        publishableKey: "test",
      },
    },
    AbortSignal,
    fetch: async () => {
      calls.push("storage");
      throw Error("Storage network failure");
    },
    sessionStorage: {
      removeItem() {
        calls.push("clearClipboard");
        if (clipboardFails) throw Error("Browser storage disabled");
      },
    },
    location: {
      reload() {
        calls.push("reload");
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, "../src/scripts/account-data.js"),
      "utf8",
    ),
    scope,
  );
  const action = scope.window.AccountData.deleteAccount("DELETE");
  if (storageFails || accountChanges) {
    await assert.rejects(
      action,
      accountChanges ? /Account changed/ : /Storage network failure/,
    );
    assert(!calls.includes("finish_account_deletion"));
    assert(!calls.includes("signOut"));
  } else {
    await action;
    assert.deepEqual(calls, [
      "begin_account_deletion",
      "finish_account_deletion",
      "clearClipboard",
      "signOut",
      "reload",
    ]);
  }
}
(async () => {
  await scenario({ clipboardFails: true });
  await scenario({ logoutFails: true });
  await scenario({ storageFails: true });
  await scenario({ accountChanges: true });
  console.log(
    "PASS: pinned deletion requests, partial-failure safety, account switches and best-effort browser cleanup after deletion.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
