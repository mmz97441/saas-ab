# TODOS — AB Consultants

Backlog des chantiers post-design-review (waves 1-3.5 shippées). Trié par catégorie + priorité.

---

## 🔴 P0 — Backend / Infra (Wave 4)

### 1. Configurer Resend SMTP en prod
**Pourquoi** : Les emails (invitations clients, rappels RDV J-20/J-14/J-7/J-3/J-1, propositions de date) n'arrivent jamais. Le code est OK, c'est juste les 5 vars d'env manquantes.

**Comment** :
1. Compte Resend → vérifier le domaine `ab-consultants.fr` (3 records DNS)
2. Générer une API key
3. Dans `functions/.env` ajouter :
   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_USER=resend
   SMTP_PASS=re_xxxxxxxxxx
   SMTP_FROM=noreply@ab-consultants.fr
   ```
4. `firebase deploy --only functions`
5. Tester en invitant un client de test

**Effort** : 30 min (5 min code, 25 min DNS si pas accès direct)
**Bloquant pour** : tout le flow d'invitation automatique. Tant que pas fait, on est sur le `mailto:` manuel (TeamManagement « Renvoyer l'invitation »).

### 2. Rotation GEMINI_API_KEY
**Pourquoi** : la clé Gemini de prod (`AIzaSyB_CyAjiVirYCoRsM1A-FUWEydernBhHZI`) a été exposée dans une conversation Claude le 2026-05-15. Elle continue de marcher mais c'est un risque.

**Comment** :
1. Google AI Studio → API keys → révoquer l'ancienne
2. Générer une nouvelle clé
3. Update `functions/.env` GEMINI_API_KEY = nouvelle valeur
4. `firebase deploy --only functions`
5. Tester le Conseiller IA

**Effort** : 10 min
**Note** : Le backup `functions/.env.audit-backup` peut être supprimé après ça (il contient l'ancienne valeur, pas critique mais inutile).

### 3. CI/CD GitHub Action
**Pourquoi** : Aujourd'hui chaque deploy = manuel (`npm run build && firebase deploy`). Risque d'oubli/erreur, surtout pour les fonctions (env mismatch = bug auth).

**Comment** :
- Créer `.github/workflows/deploy.yml`
- Trigger : push sur `main`
- Steps : install deps, build frontend, build functions, `firebase deploy --token $FIREBASE_TOKEN`
- Secret GitHub : `FIREBASE_TOKEN` (généré via `firebase login:ci`)

**Effort** : 1-2h (incluant test du workflow)

### 4. Test framework
**Pourquoi** : aucun test aujourd'hui. App B2B financière avec auth multi-tenant et règles Firestore complexes → un jour ça va péter et on ne saura pas où.

**Comment** :
- vitest + @testing-library/react pour les composants critiques (LoginScreen, ClientPortfolio, EntryForm)
- Firebase Local Emulator Suite pour tester les règles Firestore + cloud functions
- Tests à viser :
  - Auth flow (consultant vs client vs collab)
  - Rules cross-tenant leak (regression de `557cbd6`)
  - setUserRole avec chaque type d'email
  - Saisie + validation workflow
- CI : ajouter step `npm test` dans le workflow ci-dessus

**Effort** : 1 jour pour mise en place + tests critiques

---

## 🟡 P1 — UX polish résiduel (Wave 4 ou plus tard)

### AppointmentPanel
- [ ] **`scheduleAppointment` error mapping** : aujourd'hui affiche `err?.message` brut. Mapper les codes (`permission-denied`, `invalid-argument`) vers des messages français parlants
- [ ] **Past appointments section** : utilise encore un layout `p-2` compact, à harmoniser avec le nouveau pattern des empty states (icon + titre + sous-titre)
- [ ] **Reminders chip overflow** sur viewport < 380px : 5 chips + label wrap → grouper en tooltip sur petit écran

### TeamManagement
- [ ] **`addedAt` display** sur chaque row : "ajouté le 12 mars" en text-xs slate-400 sous le rôle. Audit context pour Guillaume.
- [ ] **Promote/demote auto-logout** : actuellement le user doit se déconnecter manuellement. Idéalement la fonction force un sign-out côté client (push notif ou polling). Lourd, basse priorité.

### Dashboard (vue client)
- [ ] **Marge `Saisir →` button** : actuellement visuel uniquement. Wire le `onClick` pour naviguer vers `View.Entry` (requiert ajout d'un prop `onNavigateToEntry` depuis App.tsx)

### ClientPortfolio
- [ ] **Bulk archive parallélisation** : `for await` séquentiel sur N clients = lent au-delà de 5. Passer à `Promise.allSettled([...].map(c => onToggleStatus(c)))` quand `onToggleStatus` est explicitement async.

### Wave 3 audits non encore faits
- [ ] `ExcelImportModal` : audit UX (1239 LOC, gros composant)
- [ ] `ClientModal` : audit UX (création/édition dossier client, point d'entrée critique)
- [ ] `SettingsView` : audit UX (paramétrage profit centers + objectifs)
- [ ] `QuickConfigPanel` : audit UX (configuration rapide depuis le side panel)
- [ ] `CollaboratorManager` : audit UX (gestion des accès secondaires à un dossier)

---

## 🟢 P2 — Code quality / dette technique

- [ ] **Composants volumineux** :
  - `Dashboard.tsx` ~1500 LOC → splitter en sous-composants (KPICard, BFRChart, etc.)
  - `EntryForm.tsx` ~1300 LOC → idem
  - `ConsultantDashboard.tsx` ~1250 LOC → idem
- [ ] **Duplication `dataService.ts`** : il y a un fichier `dataService.ts` à la racine ET `services/dataService.ts`. Le premier est-il utilisé ? À investiguer + supprimer si dead code.
- [ ] **`InfoTip` props mismatch** : prop `position` est passée partout mais pas dans l'interface → 6+ erreurs TS pré-existantes ignorées. Ajouter `position` à `InfoTipProps`.
- [ ] **`AIChatWidget.tsx:235`** : référence à `summary` non définie (erreur TS pré-existante). À fixer.
- [ ] **Migration `firebase-functions@latest`** : le deploy warning dit que la version actuelle est dépréciée. Risque : breaking changes mi-2027 (deprecation Cloud Runtime Config).
- [ ] **Node.js 20 deprecation** : runtime des Cloud Functions à upgrader vers Node 22 avant 2026-10-30 (warning au deploy).

---

## 🔵 P3 — Features produit (idées, non urgentes)

- [ ] **Last-message preview côté client** : la même feature qu'on a faite côté consultant (Wave 3.5), mais dans l'AIChatWidget pour qu'un client voie aussi un teaser des messages non lus
- [ ] **Composite health "primaryAction"** : la fonction `getDossierHealth` retourne déjà un champ `primaryAction` non utilisé. Le wirer pour afficher un CTA rapide depuis le row (ex: dossier "attention" → bouton « Relancer le client »)
- [ ] **Filtre date sur Historique** : actuellement filtre par année. Ajouter filtre par trimestre / mois pour navigation rapide
- [ ] **Vue cards/table toggle Cockpit** : actuellement le Cockpit n'a plus que la queue RDV + KPIs. Si on veut une vue table optionnelle, ajouter un toggle. Mais probablement pas nécessaire avec le CTA "Voir le portefeuille" qui amène vers View.Clients.
- [ ] **Conflict warning RDV cross-consultant** : si plusieurs consultants utilisent l'app (Wave Team), warning si deux consultants programment des RDV au même créneau pour le même client (rare mais déjà arrivé chez d'autres cabinets)

---

## ✅ Récemment shippé (référence)

| Wave | Commit | Contenu |
|---|---|---|
| 1 | `bf505e8` | LoginScreen a11y + privacy + polish |
| 1.5 | `a069ec2` | text-[11px] → text-xs (209 occurrences), empty states, palette cleanup, DESIGN.md |
| Auth fix | `217876e` | getIdTokenResult(true) force refresh |
| Auth fix | `4e59ffa` | getClients fix scan permission-denied |
| 2 | `8a0d2b0` | Top-5 UX wins (sidebar label, stepper, Reprendre M-1, Cockpit dedupe, header Historique) |
| 2.5 | `00c44b3` | Bulk actions HistoryView + ClientPortfolio, Non renseigné Dashboard |
| 3 | `c488d1e` | Composite health pill, À faire aujourd'hui Cockpit, auto-save EntryForm |
| 3.0 | `d6cdfaf` | Wave 3 polish — messaging textarea, RDV reminders, team validations, a11y debt |
| 3.5 | `7f2d6dd` | Last-message preview, RDV polish (Aujourd'hui, conflict, quick chips), promote/demote team |

---

**Last updated** : 2026-05-16
**Maintainer** : Guillaume (`nice.guillaume@gmail.com`)
