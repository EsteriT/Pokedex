# Publish with GitHub Pages

**Repository:** [EsteriT/Pokedex](https://github.com/EsteriT/Pokedex)

**Website:** [esterit.github.io/Pokedex](https://esterit.github.io/Pokedex/)

## First deployment

In the repository, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**. The included Pages workflow builds and verifies the frontend on pushes to `main`. You can also run it manually from **Actions → Deploy website → Run workflow**.

The workflow publishes only `dist/`. Source, tests and documentation remain in the repository, outside the deployed website. The authorized binder-cloud rollout adds Google sign-in and private Supabase persistence. See [the rollout record](HOSTED-ROLLOUT.md) for verified security checks, completed hosted acceptance and beta limits.

## Preview the deployment locally

```sh
npm run build:pages
python -m http.server 5500 --directory dist
```

Open [localhost:5500](http://localhost:5500/). The build uses the existing standalone previews, with embedded scripts, styles, fonts and cover artwork. The landing page is also copied to `index.html` for the root URL. Links stay relative so GitHub's `/Pokedex/` project path works.

Pages packaging rejects local Supabase settings and inconsistent embedded configurations. Use an unconfigured prototype build or the approved hosted HTTPS configuration; never publish localhost settings. The workflow supplies the hosted public URL/publishable key in the build step. Google/admin secrets stay out of GitHub. Provider settings and the Google authorize redirect have been verified; actual deployed sign-in/Save acceptance is recorded separately in [HOSTED-ROLLOUT.md](HOSTED-ROLLOUT.md).

## Publish an update

Change source files, rebuild, run checks and tests, then commit and push to `main`. GitHub Actions rebuilds the deployment; inspect the workflow result before assuming the website updated.

```sh
npm run build:pages
npm run check
npm test
git add <changed-files>
git commit -m "Describe the change"
git push
```

## Data and release limits

With the hosted configuration, signed-in users save private binders to their own Supabase account. Existing browser-local binders are copied only through the explicit account import action. Localhost and GitHub Pages have separate browser storage and Auth environments; a local Google session does not sign you into production.

Keep portable backups. Save is explicit; there is no autosave or automatic recovery draft. Unsaved edits and browser-local collection records can be lost when site data is cleared. Unconfigured builds retain the original browser-local prototype.

Card images use external hosts and need internet access. The catalogue and prices remain sample data. Collection synchronization, live pricing and public binder sharing are not included.
