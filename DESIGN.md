# DESIGN.md — AB Consultants

Source de vérité du design system. Toute nouvelle feature doit s'aligner sur les décisions ci-dessous. Si une exception est nécessaire, elle se documente ici.

> **Direction visuelle (depuis Wave 4)** : « Cabinet éditorial ».
> Ce n'est pas une app SaaS — c'est une revue financière. Typographie travaillée, papier chaud, chiffres traités avec soin, peu de couleurs mais utilisées avec intention. Référence mentale : Bloomberg, Financial Times, Stripe Press en serif.

## 1. Identité

**Posture** : outil de pilotage financier sérieux pour TPE/PME du transport et de la logistique. Cible : consultants experts-comptables + gérants de PME. Ton : professionnel, dense, rassurant. Pas de fun gratuit, pas de gamification superflue. Le confetti sur objectif atteint est l'unique moment ludique — c'est une exception assumée.

**Voix** : clarté, précision, vocabulaire métier. On ne dit pas « Dashboard » mais « Tableau de Bord ». On ne dit pas « settings » mais « Paramétrage Dossier ». Toujours en français.

## 2. Typographie

**Trois familles, chacune un rôle distinct** :

| Token Tailwind | Famille | Rôle |
|---|---|---|
| `font-display` | **Fraunces** (variable serif, opsz 9-144, wght 300-800, SOFT 30-100) | H1/H2/H3 de page, KPI numbers, hero, moments éditoriaux |
| `font-sans` (défaut) | **DM Sans** (variable, opsz 9-40, wght 300-700) | Corps de texte, UI labels, boutons, navigation |
| `font-mono` | **IBM Plex Mono** (400/500/600) | Chiffres tabulaires (KPI cards quand pas en Fraunces), colonnes de tableau, codes/montants |

**Pourquoi ces choix** :
- **Fraunces** apporte le caractère « cabinet d'expertise » sans virer vintage. Les axes `opsz` (optical sizing) et `SOFT` permettent de la rendre douce sur les grands titres et incisive sur les petits.
- **DM Sans** est le sans plus typographique d'Inter, lisible à toutes tailles, signature des produits B2B premium modernes (Stripe Press, Vercel docs).
- **IBM Plex Mono** porte la mémoire de l'informatique financière (IBM) — donne du sérieux aux chiffres sans tomber dans le code-style.

**Règle d'or sémantique** :
- `font-display` (Fraunces) → tout ce qui DOIT être lu en premier (titres, big numbers)
- `font-sans` (DM Sans) → tout ce qui est INTERFACE (boutons, labels, descriptions)
- `font-mono` (IBM Plex Mono) → tout ce qui DOIT s'aligner en colonnes (montants, dates ISO, IDs)

**Échelle** :

| Token | Pixel | Usage |
|---|---|---|
| `text-xs` | 12 px | Labels, métadonnées, badges, captions, eyebrow |
| `text-sm` | 14 px | Texte courant, items de navigation, contenu des cartes |
| `text-base` | 16 px | Réservé au texte long (rare dans cette app) |
| `text-lg` | 18 px | Titres de section dans les empty states |
| `text-xl` | 20 px | Titres de modaux, cards titles (DM Sans bold OU Fraunces semi-bold) |
| `text-2xl` | 24 px | H1 de page (Cockpit, Tableau de Bord) — **Fraunces** |
| `text-3xl` | 30 px | H2 hero (LoginScreen) — **Fraunces** |
| `text-4xl`/`5xl` | 36/48 px | KPI numbers très visibles — **Fraunces tabular-nums** |

**Classe utilitaire `.eyebrow`** (définie dans `index.css`) :
DM Sans 11px, 600, uppercase, letter-spacing 0.14em, couleur muted. Pour les overlines de section ("Pilotage Cabinet", "Dossier Actif", etc.).

**Règle d'or** : **jamais en dessous de 12 px** pour du contenu textuel. `text-[11px]` est interdit (a11y SC 1.4.4).

**Tabular numbers** : appliqué automatiquement à toutes les classes `font-mono` et tous les `<table>` via `font-variant-numeric: tabular-nums` (cf `index.css`).

**Graisse par défaut sur fond sombre** : `font-normal` minimum. `font-light` interdit (lisibilité dégradée).

## 3. Couleurs

### Palette `paper` (NEW — Wave 4 — surfaces et neutres chauds)

Pour TOUTES les surfaces (body, raised cards, sunken sections), bordures discrètes, texte body. Remplace l'usage du `slate-*` froid sur les surfaces.

| Token | Hex | Usage |
|---|---|---|
| `paper-50` | `#fbfaf6` | **Body background** (off-white chaud) |
| `paper-100` | `#f5f3ec` | Surfaces "sunken" (sections en retrait) |
| `paper-200` | `#ebe7da` | Bordures soft, dividers |
| `paper-300` | `#d8d3c2` | Bordures fortes, inputs au repos |
| `paper-400` | `#a8a294` | Texte disabled, icônes inactives |
| `paper-500` | `#76705f` | Texte secondaire (subtle) |
| `paper-600` | `#5a5547` | Texte body muted |
| `paper-700` | `#3f3a30` | Texte body |
| `paper-800` | `#28251f` | Texte fort |
| `paper-900` | `#171612` | Headings (alternative chaude au brand-900) |

**Pourquoi** : le `slate-50` (`#f0f4f8`) de Tailwind tire vers le bleu froid → impression "web app défaut". Le `paper-50` (`#fbfaf6`) tire vers le crème → impression "page imprimée, document de cabinet".

### Palette `brand` (recalibrée — Wave 4 — navy légèrement plus warm)

| Token | Hex | Usage type |
|---|---|---|
| `brand-50` | `#f0f4f8` | Background body, panneaux secondaires |
| `brand-100` | `#d9e2ec` | Bordures douces, états désactivés |
| `brand-200` | `#bcccdc` | Bordures inputs, dividers |
| `brand-300` | `#9fb3c8` | Placeholders, texte secondaire sur fond clair |
| `brand-400` | `#829ab1` | Icônes inactives, hints |
| `brand-500` | `#627d98` | Focus rings, accents secondaires |
| `brand-600` | `#486581` | CTA primaire (espace client), liens |
| `brand-700` | `#334e68` | Hover CTA, état actif nav (client) |
| `brand-800` | `#243b53` | Sidebar consultant (mode client), backgrounds sombres |
| `brand-900` | `#102a43` | Sidebar consultant (mode admin), CTA primaire (espace consultant) |
| `brand-950` | `#061626` | Profondeurs, badges admin |

### Palette `accent` (amber/gold — highlight, marqueur de contexte premium)

| Token | Hex | Usage |
|---|---|---|
| `accent-300` | `#fcd34d` | Highlight de termes dans le glossaire |
| `accent-400` | `#fbbf24` | Icônes de nav actives, termes glossaire |
| `accent-500` | `#f59e0b` | Badges « dossier actif », logo flag consultant |
| `accent-600` | `#d97706` | Hover sur `accent-500` |
| `accent-700` | `#b45309` | (réservé) |

**Règle** : `accent` ne sert **jamais** de CTA principal. Il marque le **contexte actif** ou un **point d'attention** (glossaire, dossier sélectionné). Le CTA primaire reste `brand-600` (client) ou `brand-900` (consultant).

### Couleurs sémantiques (Tailwind défaut)

| Sémantique | Tailwind | Usage |
|---|---|---|
| Succès, positif (CA, trésorerie >0) | `emerald-500/600/700` | KPI verts, badges « Validé », confirmation |
| Erreur, négatif, trésorerie débitrice | `red-500/600/700` | Erreurs, retraits destructifs, alertes |
| Avertissement, en attente, charges | `amber-400/500/600/700` | Statuts intermédiaires, données en retard, masse salariale, ratios charges |
| Information neutre | `slate-100/400/500/600/700` | Textes secondaires, états désactivés |
| **Marge commerciale** | `purple-500/600/700` (+ `purple-50/100/200` pour fonds) | KPI Marge, sections « Marge » dans EntryForm/Dashboard/Settings, ratio marge ConsultantDashboard |
| **Ventilation analytique / activités** | `indigo-500/600/700` (+ `indigo-50/100/200`) | Profit centers, « Répartition Activité », périodes glissantes, ratios financiers |
| **Carburant** | `blue-500/600/700` (+ `blue-50/100/200`) | Module Fuel, volumes carburant |
| Données financières (créances) | `cyan-500/600/700/800/900` | Charts BFR — actif |
| Données financières (dettes) | `rose-500/600/700/800/900` | Charts BFR — passif |

**Règle d'or sémantique** : les 3 couleurs « métier » (purple, indigo, blue) sont des **étiquettes de domaine**. Elles ne servent **jamais** à indiquer un état (positif/négatif/warning) — pour ça, utiliser exclusivement emerald/red/amber. Inversement, ne jamais peindre un élément Marge en emerald ou un élément Carburant en cyan : la couleur tag le domaine, pas la valeur.

**Couleur retirée** : `orange-*` (collision avec `amber`) — toute occurrence doit être migrée vers `amber-*` (warning) ou `red-*` (alarme dépassement seuil).

## 4. Espacement et rayons

### Border radius

| Token | Px | Usage |
|---|---|---|
| `rounded` | 4 | Inputs de recherche compacts |
| `rounded-md` | 6 | Tabs internes |
| `rounded-lg` | 8 | **Défaut pour inputs, boutons, badges** |
| `rounded-xl` | 12 | **Défaut pour cartes (`bg-white`)**, panneaux |
| `rounded-2xl` | 16 | Modaux, panneau de login (cas isolés) |
| `rounded-full` | ∞ | Avatars, pastilles de notification |

**Règle** : éviter de mélanger `rounded-xl` et `rounded-2xl` dans un même écran. Le `2xl` est réservé aux conteneurs racines (modaux). Les cartes internes restent en `xl`.

### Spacing

Échelle Tailwind par défaut. Conventions :

- Padding interne d'une carte : `p-4` (compact, listes) ou `p-5`/`p-6` (KPI, contenu riche)
- Gap entre cartes en grille : `gap-4`
- Gap dans un formulaire : `space-y-4` pour les blocs, `gap-1.5` pour label/input
- Hauteur min d'une touch target : 44 px (= `py-2.5` + texte = ~42px, acceptable ; viser `py-3` pour les CTA primaires)

## 5. Élévation

**Ombres « papier sur papier »** (Wave 4 — remplace les shadows Tailwind par défaut).
Layered : 1-2px crisp top + diffuse ambient. Signature visuelle d'impression éditoriale.

| Token | Usage |
|---|---|
| `shadow-paper-sm` | Inputs au repos, badges, mini-cards |
| `shadow-paper` | **Défaut** pour cartes (`bg-white` ou `bg-paper-100`) |
| `shadow-paper-md` | Items de navigation actifs, hover sur cartes |
| `shadow-paper-lg` | CTA primaires importants, panneaux flottants (dropdowns) |
| `shadow-paper-xl` | Modaux, panneau LoginScreen, popovers |

Les anciens tokens `shadow-sm`/`md`/`lg`/`xl`/`2xl` de Tailwind restent disponibles mais leur usage est **deprecated** dans nouvelle UI. Migrer au fur et à mesure.

**Règle** : pas de `shadow-paper-xl` sur du contenu interne. Si un élément a besoin de plus de présence, monter en taille ou en contraste, pas en ombre.

## 6. Iconographie

**Source unique** : [`lucide-react`](https://lucide.dev). Pas d'icônes ad hoc.

**Tailles** :
- `w-3 h-3` / `w-3.5 h-3.5` : décorations inline (à côté d'un label)
- `w-4 h-4` : **défaut** dans boutons, tabs
- `w-5 h-5` : nav items, actions principales
- `w-6 h-6` : titres de page (à côté du H1)
- `w-8` à `w-12` : empty states, illustrations
- `w-14`+ : héros, première impression

**Couleur par défaut** : `text-slate-400` (icônes inactives), `text-brand-500/600` (icônes actives), couleur sémantique (emerald/red/amber) pour les statuts.

## 7. Composants — patterns standards

### Carte de base
```tsx
<div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
  …
</div>
```

### Input
```tsx
<label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Label</label>
<input className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white
                  focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                  outline-none transition-all
                  placeholder-slate-300 text-slate-900" />
```

### CTA primaire
```tsx
// Espace client
<button className="bg-brand-600 hover:bg-brand-700 text-white font-bold
                   py-3 px-4 rounded-lg shadow-lg shadow-brand-900/10
                   hover:shadow-xl transition-all">…</button>

// Espace consultant
<button className="bg-brand-900 hover:bg-brand-800 …">…</button>
```

### Badge
```tsx
<span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
  Validé
</span>
```

### Empty state (pattern de référence)
```tsx
<div className="p-10 text-center animate-in fade-in duration-300">
  <div className="w-14 h-14 mx-auto rounded-full bg-brand-50 border border-brand-100
                  flex items-center justify-center mb-4">
    <Icon className="w-6 h-6 text-brand-500" />
  </div>
  <p className="font-semibold text-slate-700 mb-1">Titre court et humain</p>
  <p className="text-sm text-slate-500 leading-relaxed">
    Une phrase qui explique pourquoi c'est vide et quoi faire.
  </p>
</div>
```

### Skeleton de chargement
Toujours utiliser `<DashboardSkeleton />` ou `<TableSkeleton rows={N} />` depuis `components/ui/Skeleton.tsx`. Pas de spinner seul sur un écran complet.

## 8. États d'interaction (obligatoires)

Tout écran qui charge des données doit définir ces 5 états :

| État | Composant standard |
|---|---|
| Loading | `<DashboardSkeleton />` ou `<TableSkeleton />` |
| Empty (premier usage) | Pattern empty state ci-dessus, icône `brand-500` |
| Empty (filtre vide) | Pattern empty state, icône `slate-400`, copie « Ajustez les filtres… » |
| Error | Banner rouge : `bg-red-50 border border-red-100 text-red-600 rounded-lg p-3` + `<AlertCircle />` |
| Success | Banner vert : `bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg p-3` + `<ShieldCheck />` ou `<CheckCircle />` |

## 9. Accessibilité — règles non négociables

- **Texte ≥ 12 px** partout (cf §2).
- **Contraste WCAG AA** : 4.5:1 sur texte normal, 3:1 sur gros texte. Éviter `text-brand-300/60` ou opacités < 80% sur du texte.
- **`aria-label` obligatoire** sur tout bouton icon-only (sidebar collapsée, fermeture modaux, actions de table). `title=` n'est pas un substitut.
- **`aria-current="page"`** sur l'item de navigation actif.
- **Focus visible** : `focus:ring-2 focus:ring-brand-500` minimum. Ne jamais retirer le focus ring sans le remplacer.
- **Touch targets** : 44×44 px minimum (Apple HIG / WCAG 2.5.5).
- **`label` visible** sur tout input. Pas de placeholder-as-label.
- **`role="alert"`** ou `aria-live="polite"` sur les banners d'erreur/succès dynamiques.
- **Tooltips au clavier** : `cursor-help` sur un `<div>` n'est pas focusable. Utiliser un `<button>` ou une primitive Tooltip.

## 10. Responsive

Breakpoints Tailwind par défaut (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536).

**Convention** :
- Sidebar : `fixed` sur mobile (overlay), `lg:static` au-dessus de 1024 px.
- KPI cards : `grid-cols-2 lg:grid-cols-4`.
- Tables : version mobile en cards (`md:hidden`), version desktop en `<table>` (`hidden md:block`). Jamais de scroll horizontal forcé sur mobile.
- Formulaires : `flex-col md:flex-row` par défaut.

**Règle** : « stacked sur mobile » n'est pas un design. Chaque viewport mérite une intention.

## 11. Animation et motion

**Plugin** : `tailwindcss-animate`.

**Patterns autorisés** :
- `animate-in fade-in duration-300/500` : apparition de contenu après chargement
- `animate-in slide-in-from-top-2/slide-in-from-left-2 duration-200/300` : panneaux qui s'ouvrent
- `animate-in zoom-in-95 duration-500` : modaux, login card
- `animate-pulse` : skeletons et badges de notification
- `animate-spin` : `Loader2` uniquement

**Number counter** : `AnimatedNumber` (Dashboard.tsx) avec easing `1 - (1-x)^4`, durée 1000 ms. À réutiliser pour tout KPI numérique.

**Confetti** : `canvas-confetti` uniquement sur objectif CA atteint à 100%+. Ne pas étendre à d'autres événements (perte d'effet).

## 12. Print / PDF

Cf. `index.css` `@media print`. Toute nouvelle page exportable doit :
- Masquer `nav`, `aside`, `button` (déjà global)
- Préserver les couleurs des KPI (`-webkit-print-color-adjust: exact`)
- Empêcher les page-breaks dans les charts (`page-break-inside: avoid`)
- Format A4 paysage par défaut

## 13. Ce que ce design n'est PAS

Pour calibrer les futures features et arbitrer les ambiguïtés :

- **Pas un produit SaaS marketing** : pas de pages d'atterrissage, pas de hero avec stock photos, pas de carrousel de testimonials.
- **Pas un outil B2C** : pas d'onboarding gamifié, pas d'achievements, pas de dark patterns.
- **Pas un produit mobile-first** : la saisie sérieuse se fait sur desktop. Le mobile est un mode de consultation, pas un mode primaire de production.
- **Pas un design système open source** : pas de showcase, pas de Storybook. Les composants vivent dans `components/` et `components/ui/`.

## 14. Dette de design connue (à résorber)

À jour au 2026-05-15 :

- [ ] Pas de CSS variables — couleurs uniquement dans `tailwind.config.js`. À migrer si dark mode envisagé.
- [ ] `system-ui` non listé en fallback de `Inter`. À ajouter.
- [ ] `<HelpCircle>` dans `SmartNumberInput` (`EntryForm.tsx`) utilise `cursor-help` sur `<div>` — non focusable.
- [ ] Pas de skip-link « Aller au contenu principal » pour navigation clavier.
- [ ] Composants volumineux (`Dashboard.tsx` 1500+ LOC, `ConsultantDashboard.tsx` 1200+, `EntryForm.tsx` 1100+) : pas de refactor design, mais à scinder en sous-composants pour faciliter l'évolution visuelle.
- [ ] Pas de `<Tooltip />` primitive partagée — chaque consommateur utilise `title=` ou un pattern ad hoc.

---

**Mise à jour de ce document** : toute décision design durable (couleur, espacement, pattern de composant) doit être consignée ici dans le même PR que le code qui l'introduit.
