/* Operator-only tools. No administrator key or database output reaches a build. */
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const { randomUUID, webcrypto } = require("node:crypto");
const { encrypt, decrypt, maxBytes } = require("./backup-crypto.cjs");
const root = path.resolve(__dirname, ".."),
  scratch = path.join(root, ".scratch");
require("./backend-env.cjs")([
  "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID",
  "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET",
  "POKEDEX_BACKUP_URL",
  "POKEDEX_BACKUP_SECRET_KEY",
]);
const action = process.argv[2],
  args = process.argv.slice(3);
function cli(args) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "node_modules/supabase/dist/supabase.js"), ...args],
    { cwd: root, encoding: "utf8", maxBuffer: maxBytes, timeout: 120000 },
  );
  if (result.status !== 0 && /Access token not provided/i.test(result.stderr || ""))
    throw Error(
      "Supabase CLI is not signed in. Run npx.cmd supabase login in your terminal, then retry. The backup administrator key does not replace CLI login.",
    );
  if (result.status !== 0)
    throw Error(
      "Supabase command failed. Check the local stack or operator login privately; database output was not printed.",
    );
  return JSON.parse(result.stdout);
}
async function passphrase(confirm = false) {
  if (process.env.POKEDEX_BACKUP_PASSPHRASE)
    return process.env.POKEDEX_BACKUP_PASSPHRASE;
  if (!process.stdin.isTTY)
    throw Error(
      "Use an interactive terminal for the hidden passphrase prompt.",
    );
  async function prompt(text) {
    process.stdout.write(text);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    return new Promise((resolve, reject) => {
      let value = "";
      function done(error) {
        process.stdin.off("data", data);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
        if (error) reject(error);
        else resolve(value);
      }
      function data(chunk) {
        for (const c of chunk) {
          if (c === "\u0003") return done(Error("Cancelled."));
          if (c === "\r" || c === "\n") return done();
          if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
          else if (c >= " ") value += c;
        }
      }
      process.stdin.on("data", data);
    });
  }
  const value = await prompt(
    "Backup passphrase (hidden, at least 16 characters): ",
  );
  if (confirm && value !== (await prompt("Repeat passphrase (hidden): ")))
    throw Error("Passphrases do not match.");
  return value;
}
function target() {
  if (!args.length || (args.length === 1 && args[0] === "--local"))
    return { flags: ["--local"], label: "local" };
  if (
    args.length === 2 &&
    args[0] === "--hosted" &&
    /^[a-z]{20}$/.test(args[1])
  )
    return { flags: ["--linked", "--project-ref", args[1]], label: args[1] };
  throw Error(
    "Use --local or --hosted <project-ref>. Hosted recovery is never automatic.",
  );
}
function query(sql, t) {
  const folder = path.join(scratch, "runtime");
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, "ops-" + randomUUID() + ".sql");
  try {
    fs.writeFileSync(file, sql, { mode: 0o600, flag: "wx" });
    const result = cli([
      "db", "query", ...t.flags, "--file", file, "--output", "json",
    ]);
    // The CLI wraps rows only when agent detection is enabled.
    const rows = Array.isArray(result) ? result : result?.rows;
    if (!Array.isArray(rows))
      throw Error("Unexpected Supabase query response. No database output was printed.");
    return rows;
  } finally {
    fs.rmSync(file, { force: true });
  }
}
function model() {
  const scope = { window: {}, crypto: webcrypto, atob, structuredClone, Blob };
  for (const name of [
    "data/sample-cards.js",
    "data/sample-card-details.js",
    "data/sample-collection.js",
    "scripts/binder-schema.js",
    "scripts/editor-state.js",
    "scripts/binder-store.js",
    "scripts/collection-state.js",
    "scripts/account-backup.js",
  ])
    vm.runInNewContext(
      fs.readFileSync(path.join(root, "src", name), "utf8"),
      scope,
    );
  return scope.window.AccountBackup;
}
function portable(archive) {
  if (
    archive?.format !== "pokedex-service" ||
    archive.version !== 1 ||
    !Array.isArray(archive.accounts) ||
    !Array.isArray(archive.files)
  )
    throw Error("Invalid service archive.");
  const files = new Map();
  for (const file of archive.files) {
    if (
      !/^[0-9a-f-]{36}\/[0-9a-f]{64}\.(png|jpg|webp)$/.test(file.path) ||
      files.has(file.path)
    )
      throw Error("Invalid or duplicate artwork path.");
    files.set(file.path, file.src);
  }
  const validate = model().validate;
  return archive.accounts
    .filter((a) => !a.deleting)
    .map((account) => {
      if (!/^[0-9a-f-]{36}$/.test(account.id))
        throw Error("Invalid account identifier.");
      const binders = account.binders.map((b) => {
        const doc = structuredClone(b.document);
        const images = [
          ...(doc.cover?.theme === "custom" ? [doc.cover.artwork] : []),
          ...doc.pages
            .flatMap((p) => p.regions.map((r) => r.content))
            .concat(doc.overflow)
            .filter((c) => c?.kind === "artwork"),
        ];
        for (const image of images) {
          const stored = image.src.slice(8);
          if (
            !image.src.startsWith("storage:" + account.id + "/") ||
            !files.has(stored)
          )
            throw Error("Backup contains missing artwork.");
          image.src = files.get(stored);
        }
        return doc;
      });
      return {
        id: account.id,
        email: account.email,
        backup: validate({
          format: "pokedex-account",
          version: 1,
          exportedAt: archive.createdAt,
          binders,
          collection: account.collection?.document || { records: [] },
          artwork: [...files]
            .filter(([p]) => p.startsWith(account.id + "/"))
            .map(([, src]) => src),
        }),
      };
    });
}
async function main() {
  if (action === "recover") {
    if (args.length !== 1)
      throw Error("Use backend:recover -- <encrypted-backup-file>.");
    const file = path.resolve(args[0]);
    if (fs.statSync(file).size > maxBytes + 1048576)
      throw Error("Backup exceeds the beta limit.");
    const archive = decrypt(fs.readFileSync(file), await passphrase()),
      accounts = portable(archive);
    const folder = path.join(scratch, "recovery", randomUUID());
    fs.mkdirSync(folder, { recursive: true });
    for (const account of accounts)
      fs.writeFileSync(
        path.join(folder, account.id + ".json"),
        JSON.stringify(account.backup),
        { mode: 0o600, flag: "wx" },
      );
    fs.writeFileSync(
      path.join(folder, "owner-map.json"),
      JSON.stringify(
        accounts.map(({ id, email }) => ({ id, email })),
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
    console.log(
      "Recovered " +
        accounts.length +
        " account backup files into " +
        folder +
        ". These files are decrypted and private. No database was changed.",
    );
    return;
  }
  const t = target();
  const features = query(
    "select to_regclass('binder_private.account_deletions') is not null as controls, to_regclass('binder_private.operation_counts') is not null as counters;",
    t,
  )[0];
  if (action === "health") {
    const rows = query(
      `select (select count(*) from auth.users) as accounts,
      (select count(*) from public.binders) as binders,
      (select count(*) from public.collections) as collections,
      ${features.controls ? "(select count(*) from binder_private.account_deletions)" : "0"} as pending_deletions,
      (select count(*) from storage.objects where bucket_id='binder-artwork') as artwork_objects,
      (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects where bucket_id='binder-artwork') as artwork_bytes,
      ${features.counters ? "(select coalesce(jsonb_object_agg(category,total),'{}') from (select category,sum(count) as total from binder_private.operation_counts where day>=current_date-7 group by category) c)" : "'{}'::jsonb"} as reported_failures_7_days;`,
      t,
    );
    console.log(
      JSON.stringify(
        {
          target: t.label,
          account_controls_ready: features.controls,
          ...rows[0],
          ...query(
            fs.readFileSync(
              path.join(
                root,
                "supabase/diagnostics/portable-binder-preflight.sql",
              ),
              "utf8",
            ),
            t,
          )[0],
        },
        null,
        2,
      ),
    );
    return;
  }
  if (action !== "backup")
    throw Error("Use backend:backup, backend:recover or backend:health.");
  const password = await passphrase(true);
  let url, secret;
  if (t.label === "local") {
    const config = cli(["status", "-o", "json"]);
    url = config.API_URL;
    secret = config.SECRET_KEY || config.SERVICE_ROLE_KEY;
    if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
      throw Error("Local backup requires a loopback URL.");
  } else {
    url = process.env.POKEDEX_BACKUP_URL;
    secret = process.env.POKEDEX_BACKUP_SECRET_KEY;
    if (url !== "https://" + t.label + ".supabase.co" || !secret)
      throw Error(
        "Set the matching POKEDEX_BACKUP_URL and private POKEDEX_BACKUP_SECRET_KEY in .env.local. Never publish that key.",
      );
  }
  const rows = query(
    `select jsonb_build_object('accounts',coalesce((select jsonb_agg(jsonb_build_object(
    'id',u.id,'email',u.email,'deleting',${features.controls ? "exists(select 1 from binder_private.account_deletions where owner_id=u.id)" : "false"},
    'binders',coalesce((select jsonb_agg(jsonb_build_object('document',document) order by position) from public.binders where owner_id=u.id),'[]'::jsonb),
    'collection',(select jsonb_build_object('document',document) from public.collections where owner_id=u.id))) from auth.users u),'[]'::jsonb),
    'objects',coalesce((select jsonb_agg(jsonb_build_object('path',name,'type',metadata->>'mimetype','size',metadata->>'size')) from storage.objects where bucket_id='binder-artwork'),'[]'::jsonb)) as snapshot;`,
    t,
  );
  const snapshot = rows[0].snapshot,
    files = [];
  let total = Buffer.byteLength(JSON.stringify(snapshot));
  for (const object of snapshot.objects) {
    const response = await fetch(
      url + "/storage/v1/object/binder-artwork/" + object.path,
      {
        headers: { apikey: secret, Authorization: "Bearer " + secret },
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok)
      throw Error(
        "Artwork changed or download failed. No incomplete backup was written; retry.",
      );
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 500000 || bytes.length !== Number(object.size))
      throw Error("Artwork size did not match its snapshot.");
    const type = response.headers.get("content-type").split(";")[0];
    const src = "data:" + type + ";base64," + bytes.toString("base64");
    modelImage(src);
    total += src.length;
    if (total > maxBytes)
      throw Error("Backup exceeds 256 MB; upgrade to a streaming backup.");
    files.push({ path: object.path, src });
  }
  const archive = {
    format: "pokedex-service",
    version: 1,
    createdAt: new Date().toISOString(),
    target: t.label,
    accounts: snapshot.accounts,
    files,
  };
  portable(archive);
  const encrypted = encrypt(archive, password);
  // Verify decryption before retaining the encrypted artifact.
  const verified = decrypt(encrypted, password);
  if (verified.files.length !== files.length)
    throw Error("Backup verification failed.");
  const folder = path.join(scratch, "backups");
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(
    folder,
    "pokedex-" +
      t.label +
      "-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".pdxbackup",
  );
  fs.writeFileSync(file, encrypted, { mode: 0o600, flag: "wx" });
  console.log(
    "Encrypted, verified backup saved: " +
      file +
      ". Copy it off this computer. Store the passphrase separately.",
  );
  console.log(
    "Retention: manually delete backups older than 7 days here and from every off-computer copy location.",
  );
}
let modelImage;
if (require.main === module) {
  modelImage = model().image;
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
module.exports = { portable };
