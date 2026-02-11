
import { FinancialRecord, Month, Client, Consultant, ChatMessage, CRMNote, ExpertComment } from "../types";
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
             batch.update(clientRef, { 
                 hasUnreadMessages: sender === 'user' || isExpertHandoff,
                 lastMessageTime: timestamp
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
        const q = query(collection(db, COLL_CLIENTS), where("owner.email", "==", email));
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error: any) { 
        // Si permission denied, on renvoie l'erreur pour que l'UI sache que c'est un problème de config
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

export const deleteConsultant = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLL_CONSULTANTS, id));
};

// --- CLIENT SERVICES ---
export const getClients = async (filterByEmail?: string | null): Promise<Client[]> => {
    try {
        let q;
        if (filterByEmail) {
            q = query(collection(db, COLL_CLIENTS), where("owner.email", "==", filterByEmail));
        } else {
            q = query(collection(db, COLL_CLIENTS));
        }

        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => {
            const data = doc.data() as any;
            
            // PROTECTION CONTRE DONNÉES MANUELLES INCOMPLÈTES
            // Si data.owner n'existe pas, on le crée à la volée pour éviter le crash
            const ownerData = data.owner || {};
            
            return {
                id: doc.id,
                companyName: data.companyName || "Entreprise sans nom",
                siret: data.siret || "",
                address: data.address || "",
                zipCode: data.zipCode || "",
                city: data.city || "",
                companyPhone: data.companyPhone || "",
                managerName: data.managerName || "",
                managerPhone: data.managerPhone || "",
                owner: {
                    name: ownerData.name || data.managerName || 'Dirigeant',
                    email: ownerData.email || ''
                },
                status: data.status || 'active', 
                joinedDate: data.joinedDate || new Date().toISOString(),
                assignedConsultantEmail: data.assignedConsultantEmail || "",
                settings: data.settings || { 
                    showCommercialMargin: true, 
                    showFuelTracking: false,
                    fuelObjectives: { gasoil: 0, sansPlomb: 0, gnr: 0 }
                },
                profitCenters: data.profitCenters || [],
                hasUnreadMessages: !!data.hasUnreadMessages,
                lastMessageTime: data.lastMessageTime || null
            } as Client;
        });

    } catch (error) { 
        console.error("Erreur accès données clients", error);
        return []; 
    }
};

export const saveClient = async (client: Client): Promise<void> => {
    await setDoc(doc(db, COLL_CLIENTS, client.id), client);
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

export const saveRecord = async (record: FinancialRecord): Promise<void> => {
    await setDoc(doc(db, COLL_RECORDS, record.id), record);
};

export const deleteRecord = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLL_RECORDS, id));
};

// --- CRM SERVICES ---
const COLL_CRM_NOTES = 'crmNotes';
const COLL_EXPERT_COMMENTS = 'expertComments';

export const getCRMNotes = async (clientId: string): Promise<CRMNote[]> => {
    try {
        const q = query(collection(db, COLL_CRM_NOTES), where("clientId", "==", clientId), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CRMNote));
    } catch (error) {
        console.error("Erreur chargement notes CRM", error);
        return [];
    }
};

export const addCRMNote = async (note: Omit<CRMNote, 'id' | 'createdAt'>): Promise<void> => {
    await addDoc(collection(db, COLL_CRM_NOTES), { ...note, createdAt: serverTimestamp() });
};

export const updateCRMNote = async (id: string, updates: Partial<CRMNote>): Promise<void> => {
    await updateDoc(doc(db, COLL_CRM_NOTES, id), updates);
};

export const deleteCRMNote = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLL_CRM_NOTES, id));
};

// --- EXPERT COMMENT HISTORY ---
export const getExpertComments = async (clientId: string): Promise<ExpertComment[]> => {
    try {
        const q = query(collection(db, COLL_EXPERT_COMMENTS), where("clientId", "==", clientId), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExpertComment));
    } catch (error) {
        console.error("Erreur chargement commentaires expert", error);
        return [];
    }
};

export const saveExpertComment = async (comment: Omit<ExpertComment, 'id' | 'createdAt'> & { clientId: string }): Promise<void> => {
    const commentId = `${comment.clientId}_${comment.year}_${comment.month}`;
    await setDoc(doc(db, COLL_EXPERT_COMMENTS, commentId), { ...comment, createdAt: serverTimestamp() });
};

// --- EMAIL NOTIFICATION ---
export const sendEmailNotification = async (to: string, subject: string, htmlContent: string) => {
    try {
        await addDoc(collection(db, COLL_MAIL), {
            to,
            message: { subject, html: htmlContent },
            createdAt: serverTimestamp()
        });
    } catch (error) { console.error("Erreur envoi email:", error); }
};

// --- CONSULTANT PERMISSION ---
export const updateConsultantPermission = async (id: string, permission: string): Promise<void> => {
    await updateDoc(doc(db, COLL_CONSULTANTS, id), { permission });
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
