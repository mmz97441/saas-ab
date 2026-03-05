# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AB Consultants — Multi-tenant SaaS for financial consulting (TPE/PME). React 18 + TypeScript + Firebase + Tailwind CSS. All code is in `app-abconsultants-main/ab-consultant/`.

## Commands

### Frontend (from `app-abconsultants-main/ab-consultant/`)
```bash
npm run dev        # Vite dev server (localhost:5173)
npm run build      # Production build to dist/
```

### Cloud Functions (from `app-abconsultants-main/ab-consultant/functions/`)
```bash
npm run build      # Compile TypeScript to lib/
npm run serve      # Firebase emulators
npm run deploy     # Deploy functions only
```

### Full deploy
```bash
firebase deploy                    # Everything (hosting + functions + rules)
firebase deploy --only functions   # Functions only
firebase deploy --only hosting     # Hosting only
```

There are no test or lint commands configured.

## Architecture

### Two roles with different views
- **Consultant**: sees all clients, portfolio analytics, team management, AI advisor
- **Client**: sees only their own dossier (data entry, history, chat)

Role is determined by Firebase Auth custom claims set in `onUserCreated` trigger. Unauthorized signups are immediately deleted.

### Frontend structure
- **App.tsx** — Main shell (~40KB), manages view state and client selection. Uses `lazy()` for code splitting.
- **components/** — All UI components (Dashboard, EntryForm, ClientPortfolio, ClientModal, etc.)
- **contexts/** — AuthContext (auth + role), ConfirmContext (modal dialogs)
- **hooks/** — useClients, useRecords (real-time Firestore subscriptions via `onSnapshot`)
- **services/dataService.ts** — All Firestore CRUD operations (~600 LOC)
- **services/excelImportService.ts** — XLSX parsing with French month/sheet detection
- **lib/cloudFunctions.ts** — Typed wrappers for `httpsCallable`, configured for `europe-west1`
- **types.ts** — Domain model (Client, FinancialRecord, Consultant, ActivityEvent, etc.)

### Cloud Functions (10 functions, all `europe-west1`)
- **auth/onUserCreated.ts** — Auth trigger: sets custom claims, tracks owner login
- **auth/setUserRole.ts** — Callable: refresh claims, tracks client login
- **api/geminiProxy.ts** — Callable: secured Gemini AI proxy with rate limiting (30/hr)
- **api/exportCSV.ts** — Callable: server-side CSV generation
- **email/sendClientInvitation.ts** — Callable: sends signup email via SMTP
- **email/emailService.ts** — Nodemailer SMTP transport (Office365)
- **appointments/** — 4 functions: scheduleAppointment (callable), confirmAppointment & proposeNewDate (HTTP with token), sendDashboardReminders (cron)
- **triggers/onRecordWrite.ts** — Firestore trigger: pre-calculates `_stats` on client doc

### Data flow
1. Frontend calls `httpsCallable` via `lib/cloudFunctions.ts` (all routed to `europe-west1`)
2. Cloud Functions validate auth via `context.auth.token.role`
3. Data stored in Firestore collections: `clients`, `records`, `consultants`, `conversations`, `activities`, `appointmentTokens`
4. Real-time updates flow back via `onSnapshot` subscriptions in hooks

### Security model
- Firestore rules in `firestore.rules` enforce role-based access via custom claims
- `isConsultant()` / `isClient()` / `isAdmin()` helper functions in rules
- Clients can only access their own data (matched by `owner.email` or `clientId` claim)
- All Cloud Functions check `context.auth` before proceeding

## Key patterns
- All Cloud Functions use `functions.region('europe-west1')` — the frontend expects this region
- Financial records use French month names (`Janvier`, `Février`, etc.) as identifiers
- `_stats` field on client documents is denormalized data from `onRecordWrite` trigger — never write to it manually
- `appointmentTokens` collection provides O(1) token lookup for email confirmation links
- Rate limiter in `middleware/rateLimiter.ts` is in-memory (resets on cold start)

## Environment variables

**Frontend** uses `VITE_*` prefix (Vite convention). Firebase config + optional `VITE_GOOGLE_API_KEY`.

**Functions** use `functions/.env`: `GEMINI_API_KEY`, `SMTP_HOST/PORT/USER/PASS/FROM`, `SUPER_ADMIN_EMAIL`.
