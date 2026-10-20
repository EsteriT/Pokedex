# Pokedex · Documentation

The frontend MVP is the accepted baseline. Start with the project overview, then use the guides below for the detail you need.

| Guide | Contents |
| :--- | :--- |
| [Project overview](../README.md) | Features, local setup and development commands |
| [Frontend MVP](FRONTEND-MVP.md) | Accepted scope, milestone and known limits |
| [Backend foundation](BACKEND-FOUNDATION.md) | Binder cloud implementation, local setup and accepted hosted milestone |
| [Account collection](COLLECTION-CLOUD.md) | Collection cloud implementation, import/conflict behavior, tests and approved hosted rollout |
| [Account data and recovery](ACCOUNT-DATA-AND-RECOVERY.md) | Account export/restore/deletion, encrypted operator backups and recovery procedures |
| [Account data audit](ACCOUNT-DATA-AUDIT.md) | Pre-merge findings, fixes, diagnostic evidence and remaining hosted release gates |
| [Account controls rollout](ACCOUNT-DATA-ROLLOUT.md) | Authorized hosted migrations, security verification, deployment and manual acceptance |
| [Automated backups](AUTOMATED-BACKUPS.md) | Private R2 setup, protected Actions secrets, monitoring, expiry and rollout gates |
| [Owner cheatsheet](OPERATIONS-CHEATSHEET.md) | Which service does what, where to investigate problems, routine checks and recovery |
| [Backend audit](BACKEND-AUDIT.md) | Final security/bug fixes and pre-commit verification |
| [Hosted rollout](HOSTED-ROLLOUT.md) | Applied production migrations, security checks and completed binder acceptance |
| [Deployment](DEPLOYMENT.md) | Build and publish with GitHub Pages |
| [Current handoff](HANDOFF.md) | Implementation state and working conventions |
| [Design](DESIGN.md) | Layout, interactions and visual decisions |
| [Architecture](ARCHITECTURE.md) | Modules, state and persistence |
| [Product scope](WEBSITE-GOALS-AND-FUNCTIONS.md) | Goals and feature boundaries |
| [History](HISTORY.md) | Earlier decisions and milestones |
| [Integrity audit - 2026-10-20](INTEGRITY-AUDIT-2026-10-20.md) | Verified local-server security and restore-error fixes, cleanup and diagnostic coverage |
| [Codebase audit](CODEBASE-AUDIT.md) | Recorded audit findings and follow-up |
| [Nightly checkup — 2026-10-19](NIGHTLY-AUDIT-2026-10-19.md) | Operator privacy/download fixes, static cleanup, diagnostics and morning handoff |

**Editing the app?** Read [AGENTS.md](../AGENTS.md), change `src/`, then rebuild and run the checks. Previews are generated files.
