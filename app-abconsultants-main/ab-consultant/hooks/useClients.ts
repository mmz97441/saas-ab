import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Client } from '../types';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook temps réel pour les clients.
 *
 * - Consultant : écoute TOUS les clients via onSnapshot (temps réel)
 * - Client : écoute uniquement son propre document
 *
 * Plus besoin de refreshClients() ! Les données se mettent à jour automatiquement.
 */
export function useClients() {
  const { claims, currentUserEmail } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!claims.role || !currentUserEmail) {
      setClients([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    let q;
    if (claims.role === 'ab_consultant') {
      // Consultant voit tous les clients
      q = query(collection(db, 'clients'));
    } else {
      // Client voit uniquement son propre document
      q = query(collection(db, 'clients'), where('owner.email', '==', currentUserEmail));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Client[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          companyName: data.companyName || '',
          managerName: data.managerName || '',
          owner: data.owner || { name: '', email: '' },
          status: data.status || 'active',
          joinedDate: data.joinedDate || '',
          settings: data.settings || { showCommercialMargin: true, showFuelTracking: false },
          profitCenters: data.profitCenters || [],
          siret: data.siret || '',
          legalForm: data.legalForm || '',
          fiscalYearEnd: data.fiscalYearEnd || '',
          city: data.city || '',
          address: data.address || '',
          zipCode: data.zipCode || '',
          companyPhone: data.companyPhone || '',
          managerPhone: data.managerPhone || '',
          assignedConsultantEmail: data.assignedConsultantEmail || '',
          hasUnreadMessages: data.hasUnreadMessages || false,
          lastMessageTime: data.lastMessageTime || null,
          _stats: data._stats || null,
        } as Client;
      });

      list.sort((a, b) => a.companyName.localeCompare(b.companyName));
      setClients(list);
      setLoading(false);
    }, (error) => {
      console.error('useClients onSnapshot error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [claims.role, currentUserEmail]);

  const activeClients = useMemo(
    () => clients.filter(c => (c.status || 'active') === 'active'),
    [clients]
  );

  const archivedClients = useMemo(
    () => clients.filter(c => c.status === 'inactive'),
    [clients]
  );

  return { clients, activeClients, archivedClients, loading };
}
