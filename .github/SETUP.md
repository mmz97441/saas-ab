# CI/CD Setup

## Workflows

- **`test.yml`** — Runs on every push to `main` or `claude/**` branches, and on every PR targeting `main`. Four parallel jobs: frontend tests (vitest), Firestore rules tests (`npm run test:rules`), Cloud Functions tests (vitest in `functions/`), and TypeScript build of the frontend.
- **`deploy.yml`** — Runs only on push to `main`. Calls `test.yml` first; if all jobs pass, deploys hosting + Firestore rules + Functions to Firebase.

## Required GitHub secrets

Add these under repo Settings → Secrets and variables → Actions.

### Firebase deploy token
Generate locally on a machine where you can log into Firebase:

```bash
firebase login:ci
```

Copy the token it prints and add it as the `FIREBASE_TOKEN` secret.

### Functions environment secrets
These mirror what lives in `functions/.env` for local dev:

| Secret name           | Source                                                    |
| --------------------- | --------------------------------------------------------- |
| `GEMINI_API_KEY`      | Google AI Studio API key (Gemini)                         |
| `SUPER_ADMIN_EMAIL`   | Email that gets `isAdmin=true` on consultant signup       |
| `SMTP_HOST`           | Office365 SMTP server (e.g. `smtp.office365.com`)         |
| `SMTP_PORT`           | Typically `587`                                           |
| `SMTP_USER`           | SMTP username                                             |
| `SMTP_PASS`           | SMTP password / app password                              |
| `SMTP_FROM`           | From address used for outgoing emails                     |

The deploy job assembles these into `functions/.env` at deploy time, then runs `firebase deploy`.

## Disabling auto-deploy temporarily

The fastest way: rename or delete `.github/workflows/deploy.yml` on a feature branch, merge it, and the next push to `main` won't trigger a deploy. Restore the file when ready.

Alternative: in GitHub, go to **Actions → Deploy production → ⋯ menu → Disable workflow**. This stops it without touching files.

## Local test commands

```bash
# Frontend
cd app-abconsultants-main/ab-consultant
npm test               # vitest
npm run test:rules     # Firestore rules (needs firebase emulator)

# Functions
cd app-abconsultants-main/ab-consultant/functions
npm test               # vitest
```
