
import { FinancialRecord, Month, Client, Consultant, ChatMessage, ActivityEvent, ActivityEventType, ClientCollaborator } from "../types";
import { db, auth } from "../firebase"; 
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc, 
  addDoc,
  deleteDoc, 
  updateDoc, 
  query,
  where,
  writeBatch,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  QuerySnapshot,
  DocumentData
} from "firebase/firestore";

// COLLECTIONS
const COLL_CLIENTS = 'clients';
const COLL_RECORDS = 'records';
const COLL_CONSULTANTS = 'consultants';
const COLL_MAIL = 'mail'; 

export const MONTH_ORDER = Object.values(Month);

// --- UTILS ---
export const normalizeId = (email: string) => email.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

export const toShortMonth = (month: string): string => {
    switch (month) {
        case 'Janvier': return 'Janv';
        case 'Février': return 'Fév';
        case 'Mars': return 'Mars';
        case 'Avril': return 'Avril';
        case 'Mai': return 'Mai';
        case 'Juin': return 'Juin';
        case 'Juillet': return 'Juil';
        case 'Août': return 'Août';
        case 'Septembre': return 'Sept';
        case 'Octobre': return 'Oct';
        case 'Novembre': return 'Nov';
        case 'Décembre': return 'Déc';
        default: return month.substring(0, 4);
    }
};

// --- EMAIL & NOTIFICATION SERVICES ---
export const sendConsultantAlertEmail = async (client: Client, subject: string, htmlContent: string) => {
    try {
        const recipient = client.assignedConsultantEmail || 'admin@ab-consultants.fr';
        await addDoc(collection(db, COLL_MAIL), {
            to: recipient,
            message: { subject: `[AB-IA] ${subject} - ${client.companyName}`, html: htmlContent },
            createdAt: serverTimestamp()
        });
    } catch (error) { console.error("❌ Failed to trigger email:", error); }
};

// --- CHAT SERVICES (REAL-TIME) ---
export const sendMessage = async (
    clientId: string, 
    text: string, 
    sender: 'user' | 'ai' | 'consultant', 
    isExpertHandoff = false,
    isSystemSummary = false
) => {
    if (!clientId) throw new Error("ID Client manquant");
    const userId = auth.currentUser ? auth.currentUser.uid : 'anonymous';

    try {
        const messagesRef = collection(db, 'conversations', clientId, 'messages');
        const conversationRef = doc(db, 'conversations', clientId); 
        const clientRef = doc(db, COLL_CLIENTS, clientId);

        const batch = writeBatch(db);
        const newMessageRef = doc(messagesRef);
        const timestamp = serverTimestamp();

        batch.set(newMessageRef, {
            text,
            sender,
            isExpertHandoff,
            isSystemSummary,
            timestamp: timestamp,
            authorId: userId
        });

        const conversationUpdate: any = {
            lastUpdate: timestamp,
            lastMessage: isSystemSummary ? "📝 Note interne ajoutée" : text.substring(0, 100),
            clientId: clientId, 
            active: true
        };
        
        if (isExpertHandoff) {
             conversationUpdate.needsAttention = true;
        } else if (sender === 'consultant') {
             conversationUpdate.needsAttention = false;
        }

        batch.set(conversationRef, conversationUpdate, { merge: true });

        if (!isSystemSummary) {
             // Preview shown in consultant's inbox list (denormalized to avoid N+1 reads).
             // 80 chars matches typical 1-line truncation in the conversation list row.
             const preview = text.slice(0, 80).replace(/\n/g, ' ');
             batch.update(clientRef, {
                 hasUnreadMessages: sender === 'user' || isExpertHandoff,
                 lastMessageTime: timestamp,
                 lastMessagePreview: preview,
                 lastMessageSender: sender,
             });
        }

        await batch.commit();

    } catch (error: any) {
        console.error("❌ ÉCHEC ÉCRITURE FIREBASE:", error);
        throw error;
    }
};

export const markConversationAsRead = async (clientId: string) => {
    try {
        await updateDoc(doc(db, COLL_CLIENTS, clientId), { hasUnreadMessages: false });
        await setDoc(doc(db, 'conversations', clientId), { needsAttention: false }, { merge: true });
    } catch (e) { console.error(e); }
};

export const subscribeToChat = (clientId: string, callback: (messages: ChatMessage[]) => void) => {
    if (!clientId) return () => {};
    
    const messagesRef = collection(db, 'conversations', clientId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
        const msgs = snapshot.docs.map(doc => {
            const data = doc.data({ serverTimestamps: 'estimate' });
            return {
                id: doc.id,
                text: data.text,
                sender: data.sender,
                isExpertHandoff: data.isExpertHandoff,
                isSystemSummary: data.isSystemSummary,
                timestamp: data.timestamp
            } as ChatMessage;
        });
        callback(msgs);
    }, (error) => {
        console.error("Erreur chat snapshot:", error);
    });
};

// --- SECURITY SERVICES ---
export const checkClientEmailExists = async (email: string): Promise<boolean> => {
    try {
        // Check owner.email
        const ownerQuery = query(collection(db, COLL_CLIENTS), where("owner.email", "==", email));
        const ownerSnap = await getDocs(ownerQuery);
        if (!ownerSnap.empty) return true;

        // Check collaborators (scan all clients since Firestore can't query nested array objects)
        const allSnap = await getDocs(collection(db, COLL_CLIENTS));
        for (const doc of allSnap.docs) {
            const data = doc.data();
            const collaborators: any[] = data.collaborators || [];
            if (collaborators.some((c: any) => c.email?.toLowerCase() === email.toLowerCase() && c.status === 'active')) {
                return true;
            }
        }
        return false;
    } catch (error: any) {
        if (error.code === 'permission-denied') throw error;
        return false;
    }
};

export const checkConsultantEmailExists = async (email: string): Promise<boolean> => {
    try {
        const cleanEmail = email.toLowerCase().trim();
        
        // 1. Essai par ID normalisé
        const generatedId = normalizeId(cleanEmail);
        const docRef = doc(db, COLL_CONSULTANTS, generatedId);
        
        // getDoc peut fail avec permission-denied si la règle est stricte sur l'ID
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) return true;
        } catch(e) { /* On ignore et on tente la query */ }

        // 2. Fallback par Query (Utile si ID aléatoire manuel)
        const q = query(collection(db, COLL_CONSULTANTS), where("email", "==", cleanEmail));
        const querySnap = await getDocs(q);
        
        return !querySnap.empty;

    } catch (error: any) { 
        console.error("Erreur vérification consultant (Firestore):", error);
        if (error.code === 'permission-denied') throw error;
        return false; 
    }
};

// --- CONSULTANT TEAM SERVICES (INTERNAL) ---
export const getConsultants = async (): Promise<Consultant[]> => {
    try {
        const snapshot = await getDocs(collection(db, COLL_CONSULTANTS));
        return snapshot.docs.map(doc => {
            const data = doc.data() as any;
            return {
                id: doc.id,
                email: data.email || "",
                name: data.name || "Consultant",
                role: data.role || 'consultant',
                addedAt: data.addedAt || new Date().toISOString()
            } as Consultant;
        });
    } catch (error) { 
        console.error("Erreur chargement consultants", error);
        // On retourne tableau vide pour ne pas crasher l'app, 
        // l'utilisateur verra une liste vide mais pourra naviguer.
        return []; 
    }
};

export const addConsultant = async (consultant: Consultant): Promise<void> => {
    const robustId = normalizeId(consultant.email);
    await setDoc(doc(db, COLL_CONSULTANTS, robustId), {
        ...consultant,
        id: robustId
    });
};

export const updateConsultant = async (id: string, newName: string): Promise<void> => {
    await updateDoc(doc(db, COLL_CONSULTANTS, id), { name: newName });
};

export const updateConsultantRole = async (
    consultantId: string,
    newRole: 'admin' | 'consultant'
): Promise<void> => {
    await updateDoc(doc(db, COLL_CONSULTANTS, consultantId), { role: newRole });
};

export const deleteConsultant = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLL_CONSULTANTS, id));
};

// --- CLIENT SERVICES ---
const mapDocToClient = (doc: any): Client => {
    const data = doc.data() as any;
    const ownerData = data.owner || {};

    return {
        id: doc.id,
        companyName: data.companyName || "Entreprise sans nom",
        siret: data.siret || "",
        address: data.address || "",
        zipCode: data.zipCode || "",
        city: data.city || "",
        legalForm: data.legalForm || "",
        fiscalYearEnd: data.fiscalYearEnd || "",
        companyPhone: data.companyPhone || "",
        managerName: data.managerName || "",
        managerPhone: data.managerPhone || "",
        owner: {
            name: ownerData.name || data.managerName || 'Dirigeant',
            email: ownerData.email || ''
        },
        status: data.status || 'active',
        joinedDate: data.joinedDate || new Date().toISOString(),
        sector: data.sector || "",
        assignedConsultantEmail: data.assignedConsultantEmail || "",
        settings: data.settings || {
            showCommercialMargin: true,
            showFuelTracking: false,
            fuelObjectives: { gasoil: 0, sansPlomb: 0, gnr: 0 }
        },
        profitCenters: data.profitCenters || [],
        collaborators: (data.collaborators || []) as ClientCollaborator[],
        hasUnreadMessages: !!data.hasUnreadMessages,
        lastMessageTime: data.lastMessageTime || null
    } as Client;
};

export const getClients = async (filterByEmail?: string | null): Promise<Client[]> => {
    try {
        if (!filterByEmail) {
            // Consultant: load all clients
            const snapshot = await getDocs(query(collection(db, COLL_CLIENTS)));
            return snapshot.docs.map(mapDocToClient);
        }

        const emailLower = filterByEmail.toLowerCase();

        // Owner query — rule allows via owner.email == myEmail() per-doc
        const ownerSnap = await getDocs(query(collection(db, COLL_CLIENTS), where("owner.email", "==", emailLower)));
        const ownerClients = ownerSnap.docs.map(mapDocToClient);

        // Collaborator query — leverages denormalized collaboratorEmails array
        // (maintained by setUserRole and saveClient). Rule allows via
        // myEmail() in resource.data.collaboratorEmails per-doc.
        // The previous unfiltered scan triggered permission-denied for clients
        // under the post-557cbd6 rules (cross-tenant leak fix).
        const ownerIds = new Set(ownerClients.map(c => c.id));
        const collabClients: Client[] = [];
        try {
            const collabSnap = await getDocs(query(
                collection(db, COLL_CLIENTS),
                where("collaboratorEmails", "array-contains", emailLower)
            ));
            for (const doc of collabSnap.docs) {
                if (ownerIds.has(doc.id)) continue;
                collabClients.push(mapDocToClient(doc));
            }
        } catch (collabErr) {
            // Non-fatal: owner clients still returned. Older docs without
            // the denormalized field will be missed until they're re-saved.
            console.warn("Lecture collaborateurs indisponible:", collabErr);
        }

        return [...ownerClients, ...collabClients];
    } catch (error) {
        console.error("Erreur accès données clients", error);
        return [];
    }
};

export const saveClient = async (client: Client): Promise<void> => {
    try {
        // Dénormalise la liste des emails des collaborateurs actifs pour permettre
        // aux règles Firestore de les vérifier (un in sur un tableau de strings).
        const collaboratorEmails = (client.collaborators || [])
            .filter(c => c.status === 'active' && !!c.email)
            .map(c => c.email.toLowerCase().trim());

        const payload = stripUndefined({ ...client, collaboratorEmails });
        await setDoc(doc(db, COLL_CLIENTS, client.id), payload);
    } catch (error: any) {
        console.error("Erreur sauvegarde client", error);
        throw new Error(error?.code === 'permission-denied' ? 'Permission refusée. Vérifiez vos droits.' : 'Impossible de sauvegarder le dossier. Vérifiez votre connexion.');
    }
};

export const updateClientStatus = async (clientId: string, newStatus: 'active' | 'inactive'): Promise<void> => {
    const clientRef = doc(db, COLL_CLIENTS, clientId);
    await setDoc(clientRef, { status: newStatus }, { merge: true });
};

export const deleteClient = async (clientId: string): Promise<void> => {
    await deleteDoc(doc(db, COLL_CLIENTS, clientId));
    const q = query(collection(db, COLL_RECORDS), where("clientId", "==", clientId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
};

// --- RECORD SERVICES ---
export const getRecordsByClient = async (clientId: string): Promise<FinancialRecord[]> => {
    try {
        if (!clientId) return [];

        const q = query(collection(db, COLL_RECORDS), where("clientId", "==", clientId));
        const snapshot = await getDocs(q);
        
        const records = snapshot.docs.map(doc => {
            const data = doc.data() as any;
            
            // RECONSTRUCTION SÉCURISÉE COMPLÈTE
            return {
                id: doc.id,
                clientId: data.clientId || clientId,
                year: data.year || new Date().getFullYear(),
                month: data.month || 'Janvier',
                isValidated: !!data.isValidated,
                isPublished: !!data.isPublished,
                isSubmitted: !!data.isSubmitted,
                submittedBy: data.submittedBy || undefined,
                expertComment: data.expertComment || "",
                
                revenue: {
                    goods: data.revenue?.goods || 0,
                    services: data.revenue?.services || 0,
                    total: data.revenue?.total || 0,
                    objective: data.revenue?.objective || 0,
                    breakdown: data.revenue?.breakdown || {}
                },
                
                fuel: {
                    volume: data.fuel?.volume || 0, 
                    objective: data.fuel?.objective || 0, 
                    details: {
                      gasoil: { 
                          volume: data.fuel?.details?.gasoil?.volume || 0, 
                          objective: data.fuel?.details?.gasoil?.objective || 0 
                      },
                      sansPlomb: { 
                          volume: data.fuel?.details?.sansPlomb?.volume || 0, 
                          objective: data.fuel?.details?.sansPlomb?.objective || 0 
                      },
                      gnr: { 
                          volume: data.fuel?.details?.gnr?.volume || 0, 
                          objective: data.fuel?.details?.gnr?.objective || 0 
                      }
                    }
                },
                
                margin: {
                    rate: data.margin?.rate || 0, 
                    total: data.margin?.total || 0, 
                    breakdown: data.margin?.breakdown || {}
                },
                
                expenses: {
                    salaries: data.expenses?.salaries || 0, 
                    hoursWorked: data.expenses?.hoursWorked || 0,
                    overtimeHours: data.expenses?.overtimeHours || 0
                },
                
                bfr: {
                    receivables: {
                      clients: data.bfr?.receivables?.clients || 0,
                      state: data.bfr?.receivables?.state || 0, 
                      social: data.bfr?.receivables?.social || 0, 
                      other: data.bfr?.receivables?.other || 0, 
                      total: data.bfr?.receivables?.total || 0
                    },
                    stock: {
                      goods: data.bfr?.stock?.goods || 0, 
                      floating: data.bfr?.stock?.floating || 0, 
                      total: data.bfr?.stock?.total || 0
                    },
                    debts: {
                      suppliers: data.bfr?.debts?.suppliers || 0, 
                      state: data.bfr?.debts?.state || 0, 
                      social: data.bfr?.debts?.social || 0, 
                      salaries: data.bfr?.debts?.salaries || 0, 
                      other: data.bfr?.debts?.other || 0, 
                      total: data.bfr?.debts?.total || 0
                    },
                    total: data.bfr?.total || 0 
                },
                
                cashFlow: {
                    active: data.cashFlow?.active || 0, 
                    passive: data.cashFlow?.passive || 0, 
                    treasury: data.cashFlow?.treasury || 0 
                }
            } as FinancialRecord;
        });

        return records.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
        });
    } catch (error) { 
        console.error("Erreur chargement records", error);
        return []; 
    }
};

const stripUndefined = (value: any): any => {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(stripUndefined);
    if (typeof value === 'object') {
        const cleaned: any = {};
        for (const [key, v] of Object.entries(value)) {
            if (v !== undefined) cleaned[key] = stripUndefined(v);
        }
        return cleaned;
    }
    return value;
};

export const saveRecord = async (record: FinancialRecord): Promise<void> => {
    try {
        await setDoc(doc(db, COLL_RECORDS, record.id), stripUndefined(record));
    } catch (error: any) {
        console.error("Erreur sauvegarde record", error);
        throw new Error(error?.code === 'permission-denied' ? 'Permission refusée. Vérifiez vos droits.' : 'Impossible de sauvegarder les données. Vérifiez votre connexion.');
    }
};

export const deleteRecord = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, COLL_RECORDS, id));
    } catch (error: any) {
        console.error("Erreur suppression record", error);
        throw new Error('Impossible de supprimer l\'enregistrement. Vérifiez votre connexion.');
    }
};

export const resetDatabase = async (): Promise<void> => {
    // Firestore batch limit is 500 operations. Process in chunks.
    const MAX_BATCH_SIZE = 450;

    const deleteInBatches = async (collectionName: string) => {
        const snap = await getDocs(collection(db, collectionName));
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += MAX_BATCH_SIZE) {
            const chunk = docs.slice(i, i + MAX_BATCH_SIZE);
            const batch = writeBatch(db);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
    };

    await deleteInBatches(COLL_CLIENTS);
    await deleteInBatches(COLL_RECORDS);
};

// --- ACTIVITY TIMELINE SERVICES ---
const COLL_ACTIVITIES = 'activities';

export const logActivity = async (
    clientId: string,
    type: ActivityEventType,
    description: string,
    metadata?: Record<string, any>,
    actorEmail?: string
): Promise<void> => {
    try {
        await addDoc(collection(db, COLL_ACTIVITIES), {
            clientId,
            type,
            description,
            actorEmail: actorEmail || auth.currentUser?.email || undefined,
            metadata: metadata || {},
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Erreur log activité:", error);
    }
};

export const getClientActivities = async (clientId: string, limitCount = 30): Promise<ActivityEvent[]> => {
    try {
        const q = query(
            collection(db, COLL_ACTIVITIES),
            where("clientId", "==", clientId),
            orderBy("timestamp", "desc")
        );
        const snapshot = await getDocs(q);
        const events = snapshot.docs.map(doc => {
            const data = doc.data({ serverTimestamps: 'estimate' });
            return {
                id: doc.id,
                clientId: data.clientId,
                type: data.type as ActivityEventType,
                description: data.description,
                actorEmail: data.actorEmail,
                timestamp: data.timestamp,
                metadata: data.metadata || {}
            } as ActivityEvent;
        });
        return events.slice(0, limitCount);
    } catch (error) {
        console.error("Erreur chargement activités:", error);
        return [];
    }
};

export const subscribeToClientActivities = (
    clientId: string,
    callback: (events: ActivityEvent[]) => void,
    limitCount = 20
) => {
    if (!clientId) return () => {};
    const q = query(
        collection(db, COLL_ACTIVITIES),
        where("clientId", "==", clientId),
        orderBy("timestamp", "desc")
    );
    return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
        const events = snapshot.docs.slice(0, limitCount).map(doc => {
            const data = doc.data({ serverTimestamps: 'estimate' });
            return {
                id: doc.id,
                clientId: data.clientId,
                type: data.type as ActivityEventType,
                description: data.description,
                actorEmail: data.actorEmail,
                timestamp: data.timestamp,
                metadata: data.metadata || {}
            } as ActivityEvent;
        });
        callback(events);
    }, (error) => {
        console.error("Erreur subscription activités:", error);
    });
};

// =============================================
// CONSULTANT ALERTS
// =============================================
export interface ConsultantAlert {
  id: string;
  clientId: string;
  clientName: string;
  type: 'chat_handoff' | 'urgent_treasury' | 'compliance' | 'manual';
  message: string;
  metadata?: Record<string, any>;
  createdAt: any;
  resolved: boolean;
  resolvedAt?: any;
  resolvedBy?: string;
}

const COLL_ALERTS = 'consultantAlerts';

export async function createConsultantAlert(
  client: Client,
  type: ConsultantAlert['type'],
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  await addDoc(collection(db, COLL_ALERTS), {
    clientId: client.id,
    clientName: client.companyName || '',
    type,
    message: message.slice(0, 1000),  // cap at 1k chars
    metadata: metadata || {},
    createdAt: serverTimestamp(),
    resolved: false,
  });
}

export function subscribeToConsultantAlerts(
  callback: (alerts: ConsultantAlert[]) => void
): () => void {
  const q = query(
    collection(db, COLL_ALERTS),
    where('resolved', '==', false),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const alerts: ConsultantAlert[] = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    } as ConsultantAlert));
    callback(alerts);
  });
}

export async function markAlertResolved(alertId: string, consultantEmail: string): Promise<void> {
  await updateDoc(doc(db, COLL_ALERTS, alertId), {
    resolved: true,
    resolvedAt: serverTimestamp(),
    resolvedBy: consultantEmail,
  });
}

// =============================================
// AI FEEDBACK
// =============================================
export interface AiFeedback {
  id: string;
  clientId: string;       // which client dossier the conversation belonged to
  messageId: string;      // ID of the AI message being rated
  rating: 'up' | 'down';
  comment?: string;       // optional, future-proof
  userId: string;         // the rater's UID (could be client owner or collaborator)
  userEmail: string;
  createdAt: any;
}

const COLL_AI_FEEDBACK = 'aiFeedback';

/**
 * Submit user feedback on an AI message.
 * Best-effort — failures should not block the chat experience.
 */
export async function submitAiFeedback(
  clientId: string,
  messageId: string,
  rating: 'up' | 'down',
  comment?: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Non authentifié');

  await addDoc(collection(db, COLL_AI_FEEDBACK), {
    clientId,
    messageId,
    rating,
    comment: comment?.slice(0, 1000) || null,
    userId: user.uid,
    userEmail: user.email || '',
    createdAt: serverTimestamp(),
  });
}

export function subscribeToAiFeedback(
  callback: (feedback: AiFeedback[]) => void
): () => void {
  const q = query(
    collection(db, COLL_AI_FEEDBACK),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as AiFeedback)));
  });
}
