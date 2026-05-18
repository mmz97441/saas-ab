# TODOS — AB Consultants

Backlog des chantiers post-design-review. Trié par catégorie + priorité.

---

## 🔴 P0 — Actions backend bloquantes (besoin de toi)

### 1. Configurer Resend SMTP en prod
**Pourquoi** : Les emails (invitations clients, rappels RDV J-20/J-14/J-7/J-3/J-1, propositions de date) n'arrivent jamais. Le code est OK, c'est juste les 5 vars d'env manquantes. Le redesign du mail d'invitation (deep-link + CTA "Activer mon accès") est shippé mais dormant tant que SMTP n'est pas branché.

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
6. Ajouter les mêmes secrets sur GitHub Actions (cf. `.github/SETUP.md`)

**Effort** : 30 min (5 min code, 25 min DNS si pas accès direct)

### 2. Rotation GEMINI_API_KEY
**Pourquoi** : la clé Gemini de prod (`AIzaSyB_CyAjiVir...`) a été exposée dans une conversation Claude le 2026-05-15. Elle continue de marcher mais c'est un risque.

**Comment** :
1. Google AI Studio → API keys → révoquer l'ancienne
2. Générer une nouvelle clé
3. Update `functions/.env` GEMINI_API_KEY = nouvelle valeur
4. `firebase deploy --only functions`
5. Update aussi le secret `GEMINI_API_KEY` sur GitHub Actions
6. Tester le Conseiller IA

**Effort** : 10 min
**Note** : Le backup `functions/.env.audit-backup` peut être supprimé après ça.

---

## 🟡 P1 — UX polish résiduel

### AppointmentPanel
- [ ] **`scheduleAppointment` error mapping** : aujourd'hui affiche `err?.message` brut. Mapper les codes (`permission-denied`, `invalid-argument`) vers des messages français parlants
- [ ] **Past appointments section** : utilise encore un layout `p-2` compact, à harmoniser avec le nouveau pattern des empty states (icon + titre + sous-titre)
- [ ] **Reminders chip overflow** sur viewport < 380px : 5 chips + label wrap → grouper en tooltip sur petit écran

### TeamManagement
- [ ] **`addedAt` display** sur chaque row : "ajouté le 12 mars" en text-xs paper-400 sous le rôle
- [ ] **Promote/demote auto-logout** : actuellement le user doit se déconnecter manuellement. Idéalement la fonction force un sign-out côté client (push notif ou polling). Lourd, basse priorité.

### Dashboard (vue client)
- [ ] **Marge `Saisir →` button** : actuellement visuel uniquement. Wire le `onClick` pour naviguer vers `View.Entry` (requiert ajout d'un prop `onNavigateToEntry` depuis App.tsx)

### ClientPortfolio
- [ ] **Bulk archive parallélisation** : `for await` séquentiel sur N clients = lent au-delà de 5. Passer à `Promise.allSettled([...].map(c => onToggleStatus(c)))` quand `onToggleStatus` est explicitement async.

---

## 🟢 P2 — Code quality / dette technique

- [ ] **Composants volumineux** (refactor, risque régression vs gain — pas urgent) :
  - `Dashboard.tsx` ~1500 LOC → splitter en sous-composants (KPICard, BFRChart, etc.)
  - `EntryForm.tsx` ~1300 LOC → idem
  - `ConsultantDashboard.tsx` ~1250 LOC → idem
- [ ] **`InfoTip` props mismatch** : prop `position` est passée mais pas dans l'interface → erreurs TS pré-existantes ignorées. Vérifier que c'est encore valide après le move dans `components/ui/`.

---

## 🔵 P3 — Features produit (idées, non urgentes)

- [ ] **Last-message preview côté client** : pareil que côté consultant (Wave 3.5), mais dans AIChatWidget pour qu'un client voie aussi un teaser des messages non lus
- [ ] **Composite health "primaryAction"** : `getDossierHealth` retourne déjà un champ `primaryAction` non utilisé. Le wirer pour afficher un CTA rapide depuis le row (ex: dossier "attention" → bouton « Relancer le client »)
- [ ] **Filtre date sur Historique** : actuellement filtre par année. Ajouter filtre par trimestre / mois pour navigation rapide
- [ ] **Vue cards/table toggle Cockpit** : optionnel, probablement pas nécessaire avec le CTA "Voir le portefeuille"
- [ ] **Conflict warning RDV cross-consultant** : Wave Team — quand > 1 consultant utilisera l'app

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
| 4.1 | `b53a69b` | Fondations éditoriales : Fraunces + DM Sans + IBM Plex Mono + papier chaud + grain + CSS vars + shadow-paper |
| 4.3 | `7d07d33` | Typo éditoriale 11 surfaces (66× font-display, 63× eyebrows) |
| 4.4 | `ac9e532` | Motion : AnimatedNumber out-quint + hover-lift KPI + reveal/pulse utilities |
| 5 | `a246616` | Audit IA + fix critique (summary undefined, ALERT_HUMAN, data prop unfiltered, contextual welcome, react-markdown, RGPD clear, consultantAlerts) |
| 5.5 | `a948f1f` | IA streaming SSE + vision PDF/image + feedback thumbs (aiFeedback collection) |
| 6 (Wave 4) | `3e65985` | Test framework (82 tests) + CI/CD GitHub Actions (3 agents spécialistes) |
| 7.1 | `782eec6` | Login polish éditorial (panel features, focus refinement, "ou" divider, shield dedup) |
| 7.2 | `abb288d` | Fix Vercel build (`.npmrc` legacy-peer-deps) |
| 7.3 | `90791eb` | Mémoire dernier onglet login + deep-link `?tab=client&signup=1` dans email invitation |
| 7.4 | `fe3041d` | Idle logout 1h + modal d'avertissement 2 min (client + consultant) |
| 7.5 | `95ee3e1` | Wave 3 polish 5 surfaces (ExcelImportModal, ClientModal, SettingsView, QuickConfigPanel, CollaboratorManager) + fix AI markdown nested lists (5 agents) |
| 7.6 | `1a803f9` | 6 items flagués traités : drag-drop réel Excel + stale closure + 10Mo cap, sticky header/footer ClientModal, useConfirm CollaboratorManager, ToggleSwitch primitive (4 agents) |
| 7.7 | `8db88fe` | Infra: Node 22 + firebase-functions v6 + firebase-admin v13 + delete dead root dataService.ts |

---

**Last updated** : 2026-05-18
**Maintainer** : Guillaume (`nice.guillaume@gmail.com`)
**Branche active** : `claude/client-login-tracking-QYArB` (à merger sur `main` quand prêt)
