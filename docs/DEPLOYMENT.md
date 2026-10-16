# Publish with GitHub Pages

**Repository:** [EsteriT/Pokedex](https://github.com/EsteriT/Pokedex)

**Website:** [esterit.github.io/Pokedex](https://esterit.github.io/Pokedex/)

## First deployment

In the repository, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**. The included Pages workflow builds and verifies the frontend on pushes to `main`. You can also run it manually from **Actions → Deploy website → Run workflow**.

The workflow publishes only `dist/`. Source, tests and documentation remain in the repository, outside the deployed website. There is no server or database to configure.

## Preview the deployment locally

```sh
npm run build:pages
python -m http.server 5500 --directory dist
```

Open [localhost:5500](http://localhost:5500/). The build uses the existing standalone previews, with embedded scripts, styles, fonts and cover artwork. The landing page is also copied to `index.html` for the root URL. Links stay relative so GitHub's `/Pokedex/` project path works.

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

Each visitor saves in their own browser storage. Localhost and GitHub Pages are separate website addresses and have separate data. Download a backup from the old address and restore it on the new one to transfer a binder. A custom domain or different browser also needs this transfer.

Keep portable backups: clearing site data or using private browsing can remove local records. Save is explicit; there is no cloud synchronization or automatic recovery draft.

Card images use external hosts and need internet access. The catalogue and prices remain sample data. Hosting does not add accounts, live pricing or public binder sharing.
