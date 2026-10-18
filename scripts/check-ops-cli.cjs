const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const script = path.join(__dirname, "backend-ops.cjs");
async function check(flags, expected, fail = false, wrapped = true) {
  let calls = 0;
  const scopedRequire = (name) => {
    if (name === "node:child_process")
      return {
        spawnSync(_exe, args) {
          assert.deepEqual(Array.from(args.slice(3, 3 + expected.length)), expected);
          calls++;
          return fail && fail !== "shape"
            ? {
                status: 1,
                stderr: fail === "login"
                  ? "Access token not provided. private diagnostic details"
                  : "private diagnostic details",
              }
            : {
                status: 0,
                stdout: JSON.stringify(
                  fail === "shape" ? {} : wrapped ? { rows: [{}] } : [{}],
                ),
              };
        },
      };
    if (name === "./backend-env.cjs") return () => {};
    return require(name);
  };
  const run = vm.runInNewContext(
    fs.readFileSync(script, "utf8") + "\nmain();",
    {
      require: scopedRequire,
      module: { exports: {} },
      __dirname,
      process: {
        execPath: process.execPath,
        argv: [process.execPath, script, "health", ...flags],
      },
      console: { log() {} },
    },
  );
  if (fail)
    await assert.rejects(run, (error) =>
      error.message ===
      (fail === "shape"
        ? "Unexpected Supabase query response. No database output was printed."
        : fail === "login"
        ? "Supabase CLI is not signed in. Run npx.cmd supabase login in your terminal, then retry. The backup administrator key does not replace CLI login."
        : "Supabase command failed. Check the local stack or operator login privately; database output was not printed."),
    );
  else await run;
  assert.equal(calls, fail ? 1 : 3);
}
(async () => {
  await check(["--local"], ["--local"]);
  const ref = "pnuovoogfjzzlgmenhnq";
  await check(["--hosted", ref], ["--linked", "--project-ref", ref]);
  await check(["--hosted", ref], ["--linked", "--project-ref", ref], false, false);
  await check(["--local"], ["--local"], false, false);
  await check(["--hosted", ref], ["--linked", "--project-ref", ref], true);
  await check(["--hosted", ref], ["--linked", "--project-ref", ref], "login");
  await check(["--hosted", ref], ["--linked", "--project-ref", ref], "shape");
  console.log("PASS: operator CLI local/hosted targeting and private error output.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
