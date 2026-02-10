import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { FinancialRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { MONTH_ORDER } from '../services/dataService';

/**
 * Hook temps réel pour les records financiers d'un client.
 *
 * - Consultant : voit tous les records
 * - Client : voit uniquement les records publiés (filtrage Firestore Rules)
 *
 * Les données se mettent à jour automatiquement quand Firestore change.
 */
export function useRecords(clientId: string | null | undefined) {
  const { claims } = useAuth();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'records'),
      where('clientId', '==', clientId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: FinancialRecord[] = snapshot.docs.map(doc => {
        const d = doc.data();
        return reconstructRecord(doc.id, d);
      });

      // Tri par année puis par mois
      list.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
      });

      setRecords(list);
      setLoading(false);
    }, (error) => {
      console.error('useRecords onSnapshot error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clientId]);

  // Pour les clients, filtrer les records non publiés côté UI aussi (defense in depth)
  const visibleRecords = useMemo(() => {
    if (claims.role === 'ab_consultant') return records;
    return records.filter(r => r.isPublished);
  }, [records, claims.role]);

  return { records, visibleRecords, loading };
}

/**
 * Reconstruction défensive d'un record Firestore.
 * Gère les champs manquants/undefined pour les anciens documents.
 */
function reconstructRecord(id: string, d: any): FinancialRecord {
  return {
    id,
    clientId: d.clientId || '',
    year: d.year || new Date().getFullYear(),
    month: d.month || 'Janvier',
    isValidated: d.isValidated || false,
    isPublished: d.isPublished || false,
    isSubmitted: d.isSubmitted || false,
    expertComment: d.expertComment || '',
    revenue: {
      goods: d.revenue?.goods || 0,
      services: d.revenue?.services || 0,
      total: d.revenue?.total || 0,
      objective: d.revenue?.objective || 0,
      breakdown: d.revenue?.breakdown || {},
    },
    margin: {
      rate: d.margin?.rate || 0,
      total: d.margin?.total || 0,
      breakdown: d.margin?.breakdown || {},
    },
    expenses: {
      salaries: d.expenses?.salaries || 0,
      hoursWorked: d.expenses?.hoursWorked || 0,
      overtimeHours: d.expenses?.overtimeHours || 0,
    },
    bfr: {
      receivables: {
        clients: d.bfr?.receivables?.clients || 0,
        state: d.bfr?.receivables?.state || 0,
        social: d.bfr?.receivables?.social || 0,
        other: d.bfr?.receivables?.other || 0,
        total: d.bfr?.receivables?.total || 0,
      },
      stock: {
        goods: d.bfr?.stock?.goods || 0,
        floating: d.bfr?.stock?.floating || 0,
        total: d.bfr?.stock?.total || 0,
      },
      debts: {
        suppliers: d.bfr?.debts?.suppliers || 0,
        state: d.bfr?.debts?.state || 0,
        social: d.bfr?.debts?.social || 0,
        salaries: d.bfr?.debts?.salaries || 0,
        other: d.bfr?.debts?.other || 0,
        total: d.bfr?.debts?.total || 0,
      },
      total: d.bfr?.total || 0,
    },
    cashFlow: {
      active: d.cashFlow?.active || 0,
      passive: d.cashFlow?.passive || 0,
      treasury: d.cashFlow?.treasury || 0,
    },
    fuel: {
      volume: d.fuel?.volume || 0,
      objective: d.fuel?.objective || 0,
      details: {
        gasoil: { volume: d.fuel?.details?.gasoil?.volume || 0, objective: d.fuel?.details?.gasoil?.objective || 0 },
        sansPlomb: { volume: d.fuel?.details?.sansPlomb?.volume || 0, objective: d.fuel?.details?.sansPlomb?.objective || 0 },
        gnr: { volume: d.fuel?.details?.gnr?.volume || 0, objective: d.fuel?.details?.gnr?.objective || 0 },
      },
    },
  };
}
