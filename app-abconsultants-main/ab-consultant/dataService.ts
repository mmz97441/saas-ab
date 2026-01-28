
import { FinancialRecord, Month, Client, Consultant, ChatMessage } from "../types";
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
    isSystemSummary = false // Nouveau flag pour les résumés cachés
) => {
    if (!clientId) throw new Error("ID Client manquant");
    const userId = auth.currentUser ? auth.currentUser.uid : 'anonymous';

    try {
        const messagesRef = collection(db, 'conversations', clientId, 'messages');
        const conversationRef = doc(db, 'conversations', clientId); 
        const clientRef = doc(db, COLL_CLIENTS, clientId); // Pour mettre à jour le badge

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

        // Mise à jour des métadonnées de conversation
        const conversationUpdate: any = {
            lastUpdate: timestamp,
            lastMessage: isSystemSummary ? "📝 Note interne ajoutée" : text.substring(0, 100),
            clientId: clientId, 
            active: true
        };
        
        // LOGIQUE D'ALERTE
        if (isExpertHandoff) {
             conversationUpdate.needsAttention = true; // Déclenche le badge rouge chez le consultant
        } else if (sender === 'consultant') {
             conversationUpdate.needsAttention = false; // Le consultant a répondu, on éteint l'alerte
        }

        batch.set(conversationRef, conversationUpdate, { merge: true });

        // Mise à jour du client pour le tri dans la liste
        if (!isSystemSummary) {
             batch.update(clientRef, { 
                 hasUnreadMessages: sender === 'user' || isExpertHandoff, // True si le client parle ou demande de l'aide
                 lastMessageTime: timestamp
             });
        }

        await batch.commit();

    } catch (error: any) {
        console.error("❌ ÉCHEC ÉCRITURE FIREBASE:", error);
        throw error;
    }
};

// Marquer une conversation comme lue par le consultant
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
                isSystemSummary: data.isSystemSummary, // Récupération du flag
                timestamp: data.timestamp
            } as ChatMessage;
        });
        callback(msgs);
    });
};

// --- SECURITY SERVICES ---
export const checkClientEmailExists = async (email: string): Promise<boolean> => {
    try {
        const q = query(collection(db, COLL_CLIENTS), where("owner.email", "==", email));
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) { return false; }
};

export const checkConsultantEmailExists = async (email: string): Promise<boolean> => {
    try {
        // --- VÉRIFICATION INTELLIGENTE PAR ID ---
        // Au lieu de chercher dans toute la liste (interdit par les règles de sécurité si non connecté),
        // on devine l'ID du document à partir de l'email et on vérifie s'il existe.
        // C'est autorisé par la règle "allow get: if true;"
        
        const generatedId = email.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        console.log(`[AUTH] Checking consultant access for ID: ${generatedId}`);
        
        const docRef = doc(db, COLL_CONSULTANTS, generatedId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            console.log("[AUTH] Consultant found in database.");
            return true;
        } else {
            console.warn("[AUTH] Consultant ID not found.");
            return false;
        }
        
    } catch (error) { 
        console.error("Erreur vérification consultant (Firestore):", error);
        return false; 
    }
};

// --- CONSULTANT TEAM SERVICES (INTERNAL) ---
export const getConsultants = async (): Promise<Consultant[]> => {
    try {
        const snapshot = await getDocs(collection(db, COLL_CONSULTANTS));
        return snapshot.docs.map(doc => doc.data() as Consultant);
    } catch (error) { return []; }
};

export const addConsultant = async (consultant: Consultant): Promise<void> => {
    // IMPORTANT : On force l'ID du document à être "email sans caractères spéciaux"
    // Cela permet la vérification par ID (getDoc) lors du login.
    const robustId = consultant.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    
    await setDoc(doc(db, COLL_CONSULTANTS, robustId), {
        ...consultant,
        id: robustId 
    });
};

export const deleteConsultant = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLL_CONSULTANTS, id));
};

// --- CLIENT SERVICES ---
export const getClients = async (): Promise<Client[]> => {
    try {
        const snapshot = await getDocs(collection(db, COLL_CLIENTS));
        return snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id } as Client));
    } catch (error) { return []; }
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
export const getRecords = async (): Promise<FinancialRecord[]> => { return []; }; // Stubbed

export const getRecordsByClient = async (clientId: string): Promise<FinancialRecord[]> => {
    try {
        const q = query(collection(db, COLL_RECORDS), where("clientId", "==", clientId));
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id } as FinancialRecord));
        return records.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
        });
    } catch (error) { return []; }
};

export const saveRecord = async (record: FinancialRecord): Promise<void> => {
    await setDoc(doc(db, COLL_RECORDS, record.id), record);
};

export const deleteRecord = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLL_RECORDS, id));
};

export const resetDatabase = async (): Promise<void> => {
    const batch = writeBatch(db);
    const clientsSnap = await getDocs(collection(db, COLL_CLIENTS));
    clientsSnap.docs.forEach(d => batch.delete(d.ref));
    const recordsSnap = await getDocs(collection(db, COLL_RECORDS));
    recordsSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
};
