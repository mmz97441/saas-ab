import { FinancialRecord } from '../types';

/**
 * Insights financiers "croisés" — analyses non évidentes obtenues en croisant
 * plusieurs axes du dashboard (marge × CA, trésorerie × créances, BFR × délais…).
 *
 * IMPORTANT : tout est calculé de façon DÉTERMINISTE à partir des données saisies.
 * Aucun chiffre n'est inventé par une IA. (L'IA peut ensuite narrer ces constats,
 * mais elle ne les produit pas.) C'est ce qui rend l'analyse crédible pour un
 * outil de conseil financier.
 */

export type InsightSeverity = 'positive' | 'info' | 'warn' | 'critical';

export interface KpiInsight {
  severity: InsightSeverity;
  title: string;
  text: string;
}

/** Sous-ensemble de l'objet `kpis` du Dashboard consommé ici. */
export interface KpiData {
  revenue: number;
  objective: number;
  revenueVariation: number | null;
  globalMarginRate: number;
  marginVariation: number | null;
  marginUnset: boolean;
  treasury: number;
  treasuryVariation: number | null;
  bfr: number;
  bfrVariation: number | null;
  bfrDays: number;
  dso: number;
  dpo: number;
  dio: number;
  masseSalarialeRate: number;
  caPerHour: number;
  costPerHour: number;
  topActivities: Array<{ id: string; name: string; val: number; percent: number; marginRate: number }>;
}

export const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
export const jours = (n: number) => `${Math.round(n)} j`;
export const pct = (n: number) => `${n.toFixed(1)} %`;

/** CA : concentration d'activité + croissance à faible marge. */
export function revenueInsights(k: KpiData): KpiInsight[] {
  const out: KpiInsight[] = [];

  if (k.objective > 0) {
    const perf = (k.revenue / k.objective) * 100;
    out.push({
      severity: perf >= 100 ? 'positive' : perf >= 90 ? 'info' : 'warn',
      title: "Atteinte de l'objectif",
      text: `${eur(k.revenue)} réalisés sur ${eur(k.objective)} visés (${pct(perf)}).`,
    });
  }

  const top = k.topActivities[0];
  if (top && top.percent >= 40) {
    out.push({
      severity: top.percent >= 60 ? 'critical' : 'warn',
      title: 'Dépendance à une activité',
      text: `« ${top.name} » représente ${pct(top.percent)} de ton CA. Un ralentissement sur cette activité impacterait lourdement le chiffre d'affaires — la diversification réduit ce risque.`,
    });
  }

  // Une activité au poids élevé mais à marge nettement sous la moyenne :
  // "faire plus de volume ici ne crée pas de profit".
  const lowMarginBig = k.topActivities.find(
    (a) => a.percent >= 20 && a.marginRate > 0 && a.marginRate < k.globalMarginRate - 5,
  );
  if (lowMarginBig) {
    out.push({
      severity: 'warn',
      title: 'Croissance sans valeur',
      text: `« ${lowMarginBig.name} » pèse ${pct(lowMarginBig.percent)} du CA mais ne dégage que ${pct(lowMarginBig.marginRate)} de marge (vs ${pct(k.globalMarginRate)} en moyenne). Plus de volume ici ne crée pas forcément de profit.`,
    });
  }

  return out;
}

/** Marge : effet ciseau (CA↑ / marge↓), poids masse salariale, productivité. */
export function marginInsights(k: KpiData): KpiInsight[] {
  if (k.marginUnset) {
    return [{
      severity: 'info',
      title: 'Marge non renseignée',
      text: 'Saisis la marge dans le formulaire mensuel pour débloquer ces analyses.',
    }];
  }

  const out: KpiInsight[] = [];

  if (k.revenueVariation !== null && k.marginVariation !== null && k.revenueVariation > 2 && k.marginVariation < -0.5) {
    out.push({
      severity: 'critical',
      title: 'Effet ciseau détecté',
      text: `Ton CA progresse de ${pct(k.revenueVariation)} vs N-1, mais ton taux de marge recule de ${Math.abs(k.marginVariation).toFixed(1)} pts. Tes coûts augmentent plus vite que ton activité : la croissance grignote ta rentabilité.`,
    });
  }

  if (k.masseSalarialeRate > 0) {
    out.push({
      severity: k.masseSalarialeRate > 40 ? 'warn' : 'info',
      title: 'Poids de la masse salariale',
      text: `Les salaires représentent ${pct(k.masseSalarialeRate)} de ton CA${k.masseSalarialeRate > 40 ? ' — c\'est élevé, la productivité mérite un suivi rapproché.' : '.'}`,
    });
  }

  if (k.caPerHour > 0) {
    out.push({
      severity: 'info',
      title: 'Productivité horaire',
      text: `${eur(k.caPerHour)} de CA par heure travaillée, pour un coût salarial de ${eur(k.costPerHour)}/h.`,
    });
  }

  return out;
}

/** Trésorerie : trompe-l'œil DSO, risque URSSAF (dettes fisc./soc. > tréso). */
export function treasuryInsights(k: KpiData, snap: FinancialRecord | null): KpiInsight[] {
  const out: KpiInsight[] = [];
  const recv = snap?.bfr.receivables;
  const debts = snap?.bfr.debts;

  if (k.treasury > 0 && k.dso > 45 && recv) {
    out.push({
      severity: k.dso > 75 ? 'critical' : 'warn',
      title: "Trésorerie en trompe-l'œil",
      text: `Ta trésorerie est positive, mais tu es payé en moyenne à ${jours(k.dso)}. ${eur(recv.clients)} dorment chez tes clients — un retard de paiement peut vite tendre le cash.`,
    });
  }

  if (debts) {
    const fisSoc = (debts.state || 0) + (debts.social || 0);
    if (fisSoc > 0 && fisSoc > k.treasury) {
      out.push({
        severity: 'critical',
        title: 'Dettes fiscales & sociales > trésorerie',
        text: `Tes dettes fiscales et sociales (${eur(fisSoc)}) dépassent ta trésorerie (${eur(k.treasury)}). En cas d'appel URSSAF ou d'échéance TVA, le cash pourrait manquer.`,
      });
    }
  }

  if (k.treasuryVariation !== null) {
    out.push({
      severity: k.treasuryVariation >= 0 ? 'positive' : 'warn',
      title: 'Évolution vs N-1',
      text: `Trésorerie ${k.treasuryVariation >= 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(k.treasuryVariation).toFixed(1)} % par rapport à l'an dernier.`,
    });
  }

  return out;
}

/** BFR : cycle de conversion du cash, hausse du BFR, décalage clients/fournisseurs. */
export function bfrInsights(k: KpiData): KpiInsight[] {
  const out: KpiInsight[] = [];

  const ccc = k.dso + k.dio - k.dpo;
  out.push({
    severity: ccc > 60 ? 'warn' : 'info',
    title: 'Cycle de conversion du cash',
    text: `Encaissement clients ${jours(k.dso)} + stock ${jours(k.dio)} − paiement fournisseurs ${jours(k.dpo)} = ${jours(ccc)} d'activité à financer avant d'être payé.`,
  });

  if (k.bfrVariation !== null && k.bfrVariation > 10) {
    out.push({
      severity: k.bfrVariation > 25 ? 'critical' : 'warn',
      title: 'BFR en hausse',
      text: `Ton besoin en fonds de roulement a grimpé de ${k.bfrVariation.toFixed(1)} % vs N-1 (${eur(k.bfr)} immobilisés en moyenne). Davantage de cash est bloqué dans le cycle d'exploitation.`,
    });
  }

  if (k.dso > k.dpo + 15) {
    out.push({
      severity: 'warn',
      title: "Tu paies avant d'être payé",
      text: `Tu règles tes fournisseurs à ${jours(k.dpo)} mais tes clients te paient à ${jours(k.dso)} — un décalage de ${jours(k.dso - k.dpo)} que tu finances sur ta trésorerie.`,
    });
  }

  return out;
}
