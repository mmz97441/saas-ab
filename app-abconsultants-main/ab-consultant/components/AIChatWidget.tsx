
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, Send, X, Bot, Loader2, Sparkles, UserCheck, ChevronRight, Scale, Briefcase, ShieldCheck, UserCircle, Bell, Trash2, AlertTriangle, PhoneCall, Paperclip, FileText, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Client, FinancialRecord, ChatMessage } from '../types';
import { askFinancialAdvisor, askFinancialAdvisorStream } from '../lib/cloudFunctions';
import { useConfirmDialog } from '../contexts/ConfirmContext';
import { sendMessage, subscribeToChat, sendConsultantAlertEmail, createConsultantAlert, submitAiFeedback } from '../services/dataService';
import { db, auth } from '../firebase';
import { collection, writeBatch, getDocs, deleteDoc } from "firebase/firestore";

interface Attachment {
  id: string;          // local UUID
  mimeType: string;
  data: string;        // base64 (no data:... prefix)
  name: string;
  preview?: string;    // for images, the data URI for preview
}

const MAX_FILES = 4;
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB per file
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    const base64 = result.split(',')[1] || '';
    resolve(base64);
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const QUICK_REPLIES: { label: string; prompt: string }[] = [
  { label: 'Mon CA ce mois', prompt: "Quel est mon chiffre d'affaires du dernier mois saisi ?" },
  { label: 'Évolution N vs N-1', prompt: "Compare mon CA et ma marge entre cette année et l'année dernière." },
  { label: 'Risque trésorerie', prompt: "Y a-t-il des risques sur ma trésorerie à court terme ?" },
  { label: 'Que dit mon BFR ?', prompt: "Analyse mon BFR et explique ce qui peut être amélioré." },
  { label: 'Coût/heure', prompt: "Quel est mon coût horaire et est-il rentable ?" },
  { label: 'Prévisionnel 3 mois', prompt: "Fais une projection de mon CA et ma trésorerie sur les 3 prochains mois." },
  { label: 'Comparer à mon objectif', prompt: "Suis-je en ligne avec mon objectif annuel ?" },
  { label: "Optimisation TVA", prompt: "Quelles sont les pistes d'optimisation TVA pour mon activité ?" },
];

interface AIChatWidgetProps {
  client: Client;
  data: FinancialRecord[];
}

const getMessageTime = (msg: ChatMessage): number => {
    if (!msg.timestamp) return 0;
    if (typeof msg.timestamp.toMillis === 'function') return msg.timestamp.toMillis();
    if (msg.timestamp instanceof Date) return msg.timestamp.getTime();
    return new Date(msg.timestamp).getTime();
};

const AIChatWidget: React.FC<AIChatWidgetProps> = ({ client, data }) => {
  const confirmDialog = useConfirmDialog();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbMessages, setDbMessages] = useState<ChatMessage[]>([]);
  const [sessionCutoff, setSessionCutoff] = useState<number | null>(null);

  // BADGE TRACKING : on persiste l'ID du dernier message lu dans localStorage
  // per-client pour éviter un faux positif "1 Message Expert" à chaque reload
  // (le state in-memory partait à null → tous les messages étaient considérés non-lus).
  const lastReadStorageKey = `ab.lastReadChatMessage.${client.id}`;
  const [lastReadMessageId, setLastReadMessageIdState] = useState<string | null>(() => {
      try { return localStorage.getItem(lastReadStorageKey); } catch { return null; }
  });
  // Re-sync when switching between clients (consultant Aperçu Mode Client).
  // useState initializer only runs once on mount; without this effect, switching
  // clients would keep the previous client's lastReadMessageId in memory.
  useEffect(() => {
      try { setLastReadMessageIdState(localStorage.getItem(lastReadStorageKey)); } catch { /* ignore */ }
  }, [client.id, lastReadStorageKey]);
  const setLastReadMessageId = (id: string | null) => {
      setLastReadMessageIdState(id);
      try {
          if (id === null) localStorage.removeItem(lastReadStorageKey);
          else localStorage.setItem(lastReadStorageKey, id);
      } catch { /* localStorage blocked — fail open */ }
  };

  // F-04 : streaming state (local, not persisted until complete)
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const streamingTextRef = useRef('');

  // F-15 : file attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // F-12 : feedback tracking per message
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SESSION_TIMEOUT_MS = 90 * 60 * 1000; // 90 minutes
  const SESSION_WARNING_MS = 80 * 60 * 1000; // Warning at 80 minutes
  const [sessionWarning, setSessionWarning] = useState(false);

  // LOGIQUE BADGE : S'allume si un message du consultant n'a pas encore été lu
  const hasUnreadConsultantMessage = useMemo(() => {
      if (dbMessages.length === 0) return false;

      // Trouver l'index du dernier message lu
      const lastReadIdx = lastReadMessageId
          ? dbMessages.findIndex(m => m.id === lastReadMessageId)
          : -1;

      // Vérifier s'il y a des messages consultant APRÈS le dernier message lu
      const unreadMessages = lastReadIdx >= 0
          ? dbMessages.slice(lastReadIdx + 1)
          : dbMessages; // Si rien n'a été lu, tous les messages sont "non lus"

      return unreadMessages.some(m => m.sender === 'consultant');
  }, [dbMessages, lastReadMessageId]);

  useEffect(() => {
    if (!client.id) return;
    
    const unsubscribe = subscribeToChat(client.id, (msgs) => {
        setDbMessages(msgs);
        
        // LOGIQUE DE SESSION AMÉLIORÉE
        // On ne regarde que les vrais messages utilisateurs/IA/Consultant (pas les résumés systèmes cachés)
        const realMessages = msgs.filter(m => !m.isSystemSummary);
        
        if (realMessages.length > 0) {
            const lastMsg = realMessages[realMessages.length - 1];
            const lastTime = getMessageTime(lastMsg);
            const now = Date.now();

            // Warning at 80min, cutoff at 90min
            if ((now - lastTime) > SESSION_TIMEOUT_MS) {
                setSessionCutoff(now);
                setSessionWarning(false);
            } else if ((now - lastTime) > SESSION_WARNING_MS) {
                setSessionWarning(true);
            }
        }
    });
    
    return () => unsubscribe();
  }, [client.id]);

  // EFFET : Quand on ouvre la fenêtre, on marque le dernier message comme lu localement
  useEffect(() => {
      if (isOpen && dbMessages.length > 0) {
          const lastMsg = dbMessages[dbMessages.length - 1];
          setLastReadMessageId(lastMsg.id);
      }
  }, [isOpen, dbMessages]);

  // F-05 : Message de bienvenue personnalisé et contextuel
  const buildWelcomeMessage = (): string => {
      const name = client.managerName?.split(' ')[0] || 'Monsieur/Madame';
      const greeting = `Bonjour ${name}.`;

      if (!data || data.length === 0) {
          return `${greeting} Ravi de vous retrouver.\n\nQuand vous aurez saisi vos premières données mensuelles, je pourrai analyser votre situation. En attendant, je peux répondre à vos questions sur la gestion, la fiscalité ou le social.`;
      }

      const MONTH_ORDER = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      const sortedByDate = [...data].sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
      });
      const lastRecord = sortedByDate[sortedByDate.length - 1];
      if (!lastRecord) return `${greeting} Comment puis-je vous aider aujourd'hui ?`;

      const insights: string[] = [];

      // Insight 1 : alerte trésorerie
      if (lastRecord.cashFlow?.treasury < 0) {
          insights.push("votre trésorerie est négative");
      }

      // Insight 2 : écart vs objectif
      if (lastRecord.revenue?.objective > 0) {
          const perf = (lastRecord.revenue.total / lastRecord.revenue.objective) * 100;
          if (perf < 85) {
              insights.push(`votre CA de ${lastRecord.month} est à ${perf.toFixed(0)}% de l'objectif`);
          } else if (perf >= 110) {
              insights.push(`votre CA de ${lastRecord.month} dépasse l'objectif de ${(perf - 100).toFixed(0)}%`);
          }
      }

      // Insight 3 : comparaison N-1
      const sameMonthN1 = sortedByDate.find(r =>
          r.month === lastRecord.month && r.year === lastRecord.year - 1
      );
      if (sameMonthN1 && sameMonthN1.revenue?.total > 0) {
          const variation = ((lastRecord.revenue.total - sameMonthN1.revenue.total) / sameMonthN1.revenue.total) * 100;
          if (Math.abs(variation) > 15) {
              insights.push(`votre CA évolue de ${variation > 0 ? '+' : ''}${variation.toFixed(0)}% vs N-1`);
          }
      }

      if (insights.length === 0) {
          return `${greeting} Vos chiffres de ${lastRecord.month} ${lastRecord.year} sont à jour. Sur quoi voulez-vous qu'on travaille ?`;
      }

      const topInsight = insights[0];
      return `${greeting} Je viens de regarder votre dossier : **${topInsight}**.\n\nVoulez-vous qu'on en discute ?`;
  };

  // FILTRE DES MESSAGES VISIBLES (F-08 : on ne filtre plus par sessionCutoff)
  const visibleMessages = useMemo(() => {
      // Toujours masquer les messages système interne (résumés)
      const filtered = dbMessages.filter(m => !m.isSystemSummary);

      // Si aucun message réel, afficher le message de bienvenue personnalisé
      if (filtered.length === 0) {
          return [{
                id: 'welcome-msg',
                text: buildWelcomeMessage(),
                sender: 'ai',
                timestamp: new Date()
            } as ChatMessage];
      }

      return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbMessages, client.managerName, data]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages, isOpen, streamingText]);

  // F-10 : Nouvelle conversation (RGPD-friendly)
  const handleClearHistory = async () => {
      const ok = await confirmDialog({
          title: 'Démarrer une nouvelle conversation ?',
          message: "La conversation actuelle sera masquée et une nouvelle session démarrera. Vos messages restent enregistrés dans votre dossier.\n\nPour une suppression définitive (RGPD), contactez votre consultant ou écrivez à contact@ab-consultants.fr.",
          variant: 'info',
          confirmLabel: 'Nouvelle conversation',
      });
      if (!ok) return;
      setSessionCutoff(Date.now());
  };

  // F-15 : handle file picker
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';  // reset so same file can be re-selected
    if (files.length === 0) return;

    const newAttachments: Attachment[] = [];
    for (const file of files) {
      if (attachments.length + newAttachments.length >= MAX_FILES) break;
      if (!ALLOWED_MIMES.includes(file.type)) {
        await confirmDialog({
          title: 'Format non supporté',
          message: `${file.name}: seuls PDF / PNG / JPEG / WebP sont acceptés.`,
          variant: 'danger',
          confirmLabel: 'OK',
          showCancel: false,
        });
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        await confirmDialog({
          title: 'Fichier trop volumineux',
          message: `${file.name}: maximum 8 MB par fichier.`,
          variant: 'danger',
          confirmLabel: 'OK',
          showCancel: false,
        });
        continue;
      }
      const data = await fileToBase64(file);
      const isImage = file.type.startsWith('image/');
      newAttachments.push({
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        mimeType: file.type,
        data,
        name: file.name,
        preview: isImage ? `data:${file.type};base64,${data}` : undefined,
      });
    }
    if (newAttachments.length > 0) setAttachments([...attachments, ...newAttachments]);
  };

  // F-12 : thumbs feedback handler
  const handleFeedback = async (messageId: string, rating: 'up' | 'down') => {
    if (feedbackGiven[messageId]) return;
    setFeedbackGiven(prev => ({ ...prev, [messageId]: rating }));
    try {
      await submitAiFeedback(client.id, messageId, rating);
    } catch (e) {
      console.warn('Feedback failed:', e);
      // Don't revert UI — feedback is best-effort
    }
  };

  // Build the financial context payload (shared between streaming + fallback callable)
  const buildFinancialContext = () => {
    const MONTH_ORDER = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const sortedRecords = [...data].sort((a, b) => a.year !== b.year ? a.year - b.year : MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month));
    const lastRecord = sortedRecords[sortedRecords.length - 1];

    const byYear: Record<number, FinancialRecord[]> = {};
    for (const r of sortedRecords) { if (!byYear[r.year]) byYear[r.year] = []; byYear[r.year].push(r); }

    const syntheseAnnuelle = Object.entries(byYear).map(([year, recs]) => {
        const totalCA = recs.reduce((s, r) => s + r.revenue.total, 0);
        const totalObj = recs.reduce((s, r) => s + r.revenue.objective, 0);
        const totalMargin = recs.reduce((s, r) => s + (r.margin?.total || 0), 0);
        const totalSalaries = recs.reduce((s, r) => s + r.expenses.salaries, 0);
        const totalHours = recs.reduce((s, r) => s + r.expenses.hoursWorked, 0);
        const lastRec = recs[recs.length - 1];
        return {
            annee: Number(year), nb_mois: recs.length,
            ca_total: Math.round(totalCA), objectif_total: Math.round(totalObj),
            marge_totale: Math.round(totalMargin), masse_salariale: Math.round(totalSalaries),
            heures: Math.round(totalHours),
            tresorerie: lastRec ? Math.round(lastRec.cashFlow.treasury) : 0,
            bfr: lastRec ? Math.round(lastRec.bfr.total) : 0,
            detail_mensuel: recs.map(r => ({
                mois: r.month, ca: Math.round(r.revenue.total), objectif: Math.round(r.revenue.objective),
                marge: Math.round(r.margin?.total || 0), tresorerie: Math.round(r.cashFlow.treasury),
                bfr: Math.round(r.bfr.total), salaires: Math.round(r.expenses.salaries), heures: Math.round(r.expenses.hoursWorked),
            }))
        };
    });

    return {
        companyName: client.companyName, managerName: client.managerName,
        sector: client.sector, legalForm: client.legalForm,
        syntheseAnnuelle,
        situationActuelle: lastRecord ? {
            mois: `${lastRecord.month} ${lastRecord.year}`,
            tresorerie: Math.round(lastRecord.cashFlow.treasury),
            ca: Math.round(lastRecord.revenue.total),
            bfr: Math.round(lastRecord.bfr.total),
        } : null,
    };
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;
    const userText = input;
    const localAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setIsLoading(true);
    streamingTextRef.current = '';
    setStreamingText('');

    try {
        await sendMessage(client.id, userText, 'user');
    } catch (e: any) {
        setIsLoading(false);
        setStreamingText(null);
        streamingTextRef.current = '';
        return;
    }

    // Build history + context once (shared between streaming + fallback)
    const contextMessages = visibleMessages.filter(m => m.id !== 'welcome-msg');
    const history = contextMessages
        .filter(m => !m.isSystemSummary)
        .slice(-15)
        .map(m => ({ role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model', text: m.text }));
    const financialContext = buildFinancialContext();

    try {
        await askFinancialAdvisorStream(
            {
                query: userText,
                financialContext,
                history,
                attachments: localAttachments.map(a => ({ mimeType: a.mimeType, data: a.data, name: a.name })),
            },
            (chunk) => {
                if (chunk.text) {
                    streamingTextRef.current += chunk.text;
                    setStreamingText(streamingTextRef.current);
                }
                if (chunk.error) throw new Error(chunk.error);
            },
        );

        // Stream complete — persist final message (single Firestore write)
        let finalText = streamingTextRef.current;
        let isAlert = false;
        if (finalText.includes('[ALERT_HUMAN]')) {
            isAlert = true;
            finalText = finalText.replace('[ALERT_HUMAN]', '').trim();
            handleManualHandoff(true);
        }
        await sendMessage(client.id, finalText, 'ai', isAlert);

    } catch (streamErr: any) {
        // FALLBACK to non-streaming callable on stream failure
        console.warn('Stream failed, falling back:', streamErr);
        try {
            const result = await askFinancialAdvisor({ query: userText, mode: 'chat', financialContext, history });
            let finalText = result.text;
            let isAlert = false;
            if (finalText.includes('[ALERT_HUMAN]')) {
                isAlert = true;
                finalText = finalText.replace('[ALERT_HUMAN]', '').trim();
                handleManualHandoff(true);
            }
            await sendMessage(client.id, finalText, 'ai', isAlert);
        } catch (e: any) {
            const errorMsg = e?.message?.includes('Limite') ? e.message : "Erreur connexion IA.";
            try { await sendMessage(client.id, errorMsg, 'ai'); } catch(err) {}
        }
    } finally {
        setIsLoading(false);
        setStreamingText(null);
        streamingTextRef.current = '';
    }
  };

  const handleManualHandoff = async (skipUserMessage = false) => {
      setIsLoading(true);
      const msg = "Je souhaite être recontacté par mon consultant.";
      
      try {
          if (!skipUserMessage) {
            await sendMessage(client.id, msg, 'user');
          }
          
          if (!skipUserMessage) {
              await sendMessage(
                  client.id, 
                  "C'est noté. J'ai envoyé une alerte prioritaire à votre consultant référent.", 
                  'ai', 
                  true 
              );
          }

          const transcript = visibleMessages.slice(-20).map(m => `${m.sender.toUpperCase()}: ${m.text}`).join('\n');
          const summaryResult = await askFinancialAdvisor({
              query: transcript,
              mode: 'summary',
              financialContext: { companyName: client.companyName },
          });
          await sendMessage(client.id, summaryResult.text, 'ai', false, true);

          // FIX 1 : bug `summary` -> `summaryResult.text`
          // FIX 2 : double notification — email + Firestore (resilient si SMTP down)
          const triggeredBy = skipUserMessage ? 'ai_alert_human' : 'client_manual_handoff';

          try {
              await sendConsultantAlertEmail(
                  client,
                  "Demande de relais (Chat)",
                  `Le client <strong>${client.companyName}</strong> demande de l'aide.<br/><br/><strong>Dernier résumé IA :</strong><br/><pre>${summaryResult.text}</pre>`
              );
          } catch (emailErr) {
              console.error("Email alert failed (Firestore alert will still fire)", emailErr);
          }

          try {
              await createConsultantAlert(client, 'chat_handoff', summaryResult.text, {
                  source: 'ai_chat',
                  triggeredBy,
                  transcriptPreview: transcript.slice(0, 500),
              });
          } catch (alertErr) {
              console.error("Firestore consultant alert failed", alertErr);
          }

      } catch (e) {
          console.error("Handoff error", e);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label={hasUnreadConsultantMessage ? 'Ouvrir le chat — 1 message non lu de votre consultant' : 'Ouvrir l\'assistant IA'}
          title={hasUnreadConsultantMessage ? 'Message de votre consultant non lu' : 'Assistant IA — Conseiller financier'}
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-2 group border
            ${hasUnreadConsultantMessage
                ? 'bg-red-600 text-white border-red-500 animate-bounce'
                : 'bg-gradient-to-r from-brand-700 to-brand-900 text-white border-brand-600/50'
            }`}
        >
          <div className="relative">
            {hasUnreadConsultantMessage ? (
                <Bell className="w-6 h-6 animate-wiggle" />
            ) : (
                <Sparkles className="w-6 h-6 animate-pulse text-accent-500" />
            )}
            {hasUnreadConsultantMessage && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-red-600"></span>
            )}
          </div>
          <span className="font-semibold pr-2 hidden group-hover:block whitespace-nowrap overflow-hidden">
             {hasUnreadConsultantMessage ? "1 Message Expert" : "Assistant IA"}
          </span>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full sm:w-[400px] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col border border-brand-200 animate-in zoom-in-95 duration-200 overflow-hidden">
          <div className="bg-brand-900 p-4 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-700 to-brand-800 flex items-center justify-center shadow-inner border border-white/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Assistant IA</h3>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-400"></span>
                    <p className="text-xs text-brand-300">Propulsé par IA • AB Consultants</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
                {/* BOUTON CORBEILLE / RESET */}
                <button onClick={handleClearHistory} className="text-brand-400 hover:text-red-400 p-1 rounded-full hover:bg-white/10 transition" title="Démarrer une nouvelle conversation" aria-label="Démarrer une nouvelle conversation">
                    <Trash2 className="w-5 h-5" />
                </button>
                <button onClick={() => setIsOpen(false)} aria-label="Fermer la conversation" title="Fermer la conversation" className="text-brand-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-brand-50">
            {visibleMessages.map((msg, i) => {
              // F-08 : séparateur visuel "Nouvelle session" si gap > 90min entre 2 messages
              const prev = i > 0 ? visibleMessages[i - 1] : null;
              const showSeparator = !!prev && (getMessageTime(msg) - getMessageTime(prev)) > 90 * 60 * 1000;
              return (
              <React.Fragment key={msg.id}>
                {showSeparator && (
                    <div className="flex items-center gap-3 my-4" aria-label="Nouvelle session">
                        <div className="flex-1 h-px bg-paper-200" />
                        <span className="eyebrow text-paper-500 italic">Nouvelle session</span>
                        <div className="flex-1 h-px bg-paper-200" />
                    </div>
                )}
                <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>

                  {msg.sender === 'ai' && !msg.isExpertHandoff && (
                     <div className="w-8 h-8 rounded-full bg-white border border-brand-200 flex items-center justify-center shadow-sm mr-2 shrink-0 self-end mb-1">
                        <Bot className="w-4 h-4 text-brand-600" />
                     </div>
                  )}

                  {msg.sender === 'consultant' && (
                     <div className="w-8 h-8 rounded-full bg-brand-900 border border-brand-700 flex items-center justify-center shadow-sm mr-2 shrink-0 self-end mb-1">
                        <ShieldCheck className="w-4 h-4 text-accent-500" />
                     </div>
                  )}

                  <div
                    className={`
                      max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative
                      ${msg.sender === 'user'
                        ? 'bg-gradient-to-br from-brand-700 to-brand-900 text-white rounded-br-none shadow-brand-900/20'
                        : msg.sender === 'consultant'
                          ? 'bg-white border-l-4 border-l-accent-500 text-slate-800 rounded-bl-none shadow-md'
                          : msg.isExpertHandoff
                              ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 text-emerald-900'
                              : 'bg-white text-slate-600 border border-brand-100 rounded-bl-none shadow-brand-200/50'
                      }
                    `}
                  >
                    {msg.sender === 'consultant' && (
                        <div className="eyebrow text-accent-600 mb-1 flex items-center gap-1">
                            <UserCircle className="w-3 h-3" /> Consultant
                        </div>
                    )}

                    {msg.isExpertHandoff && (
                        <div className="flex items-center gap-2 font-semibold mb-2 text-emerald-700 border-b border-emerald-200/50 pb-2 font-display">
                            <div className="p-1 bg-emerald-100 rounded-full"><UserCheck className="w-3 h-3" /></div>
                            Transmis au consultant
                        </div>
                    )}

                    {/* F-09 : rendu markdown riche via react-markdown */}
                    {msg.sender === 'ai' ? (
                      <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_h1]:font-display [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_strong]:font-semibold [&_strong]:text-paper-900 [&_em]:italic [&_a]:text-brand-700 [&_a]:underline [&_code]:font-mono [&_code]:text-xs [&_code]:bg-paper-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-paper-100 [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_table]:text-xs [&_th]:font-semibold [&_th]:text-left [&_th]:p-1 [&_td]:p-1 [&_td]:border-t [&_td]:border-paper-200">
                        <ReactMarkdown
                          components={{
                            ul: ({children}) => <ul className="list-disc ml-4 space-y-0.5">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal ml-4 space-y-0.5">{children}</ol>,
                            table: ({children}) => <table className="w-full my-2 border-collapse">{children}</table>,
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      msg.text
                    )}

                    {/* F-12 : thumbs feedback on AI messages (excluding welcome + handoff) */}
                    {msg.sender === 'ai' && msg.id !== 'welcome-msg' && (
                      <div className="mt-2 flex gap-1 opacity-60 hover:opacity-100 transition-opacity">
                        {[
                          { rating: 'up' as const, Icon: ThumbsUp, label: 'Utile' },
                          { rating: 'down' as const, Icon: ThumbsDown, label: 'Pas utile' },
                        ].map(({ rating, Icon, label }) => {
                          const given = feedbackGiven[msg.id];
                          const active = given === rating;
                          return (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => handleFeedback(msg.id, rating)}
                              disabled={!!given}
                              aria-label={label}
                              title={label}
                              className={`p-1 rounded transition-colors ${
                                active
                                  ? rating === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
                                  : 'text-paper-400 hover:text-paper-700 hover:bg-paper-100'
                              }`}
                            >
                              <Icon className="w-3 h-3" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
              );
            })}
            
            {/* F-04 : streaming bubble (local state, not yet in Firestore) */}
            {streamingText !== null && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-white border border-paper-200 flex items-center justify-center shadow-paper-sm mr-2 shrink-0 self-end mb-1">
                  <Bot className="w-4 h-4 text-brand-600" />
                </div>
                <div className="max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-paper-sm bg-white text-paper-700 border border-paper-200 rounded-bl-none">
                  <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_strong]:font-semibold [&_strong]:text-paper-900">
                    <ReactMarkdown>{streamingText}</ReactMarkdown>
                  </div>
                  <span className="inline-block w-1 h-4 bg-brand-500 ml-0.5 animate-pulse align-middle" aria-hidden="true" />
                </div>
              </div>
            )}

            {isLoading && streamingText === null && (
              <div className="flex justify-start items-end">
                <div className="w-8 h-8 rounded-full bg-white border border-brand-100 flex items-center justify-center shadow-sm mr-2 shrink-0 mb-1"><Bot className="w-4 h-4 text-brand-600 animate-pulse" /></div>
                <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-brand-100 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                  <span className="text-xs text-brand-400 font-medium">Analyse Stratégique en cours...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-brand-100 shrink-0">
             {/* SESSION TIMEOUT WARNING */}
             {sessionWarning && (
                 <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2 text-xs text-amber-700 animate-in fade-in duration-200">
                     <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                     <span>Votre session expire bientôt. Envoyez un message pour la prolonger.</span>
                 </div>
             )}
             {/* F-15 : attachment preview row */}
             {attachments.length > 0 && (
               <div className="mb-2 flex gap-2 flex-wrap">
                 {attachments.map(a => (
                   <div key={a.id} className="relative flex items-center gap-2 px-2 py-1 bg-brand-50 border border-brand-200 rounded-lg max-w-[150px]">
                     {a.preview ? (
                       <img src={a.preview} alt={a.name} className="w-8 h-8 rounded object-cover" />
                     ) : (
                       <FileText className="w-5 h-5 text-brand-600 shrink-0" />
                     )}
                     <span className="text-xs font-medium text-brand-800 truncate">{a.name}</span>
                     <button
                       type="button"
                       onClick={() => setAttachments(attachments.filter(x => x.id !== a.id))}
                       aria-label={`Retirer ${a.name}`}
                       className="text-brand-400 hover:text-red-600 shrink-0"
                     >
                       <X className="w-3 h-3" />
                     </button>
                   </div>
                 ))}
               </div>
             )}
             {/* F-06 : suggestions persistantes au-dessus du champ de saisie */}
             <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar -mx-3 px-3" style={{scrollbarWidth: 'none'}}>
                 {QUICK_REPLIES.map((q) => (
                     <button
                         key={q.label}
                         type="button"
                         onClick={() => setInput(q.prompt)}
                         className="shrink-0 whitespace-nowrap px-3 py-1.5 bg-paper-100 hover:bg-brand-100 text-paper-700 hover:text-brand-700 text-xs font-medium rounded-full border border-paper-200 hover:border-brand-200 transition-colors duration-200 ease-premium"
                     >
                         {q.label}
                     </button>
                 ))}
             </div>
            <div className="flex items-center gap-2 relative">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Votre message..." className="flex-1 bg-brand-50 text-brand-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:bg-white transition-all" />
              {/* F-15 : hidden file input + paperclip button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Joindre un fichier"
                title="Joindre un PDF ou une image (bilan, facture…)"
                className="p-3 bg-paper-100 hover:bg-paper-200 text-paper-700 rounded-xl transition-colors"
                disabled={isLoading || attachments.length >= MAX_FILES}
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button onClick={handleSend} disabled={isLoading || (!input.trim() && attachments.length === 0)} aria-label="Envoyer le message" title="Envoyer le message" className="p-3 bg-brand-700 text-white rounded-xl hover:bg-brand-800 disabled:opacity-50 transition-all shadow-md"><Send className="w-4 h-4" /></button>
            </div>
            {/* ALERT CONSULTANT - More visible after 3+ messages */}
            {visibleMessages.length > 3 ? (
                <button onClick={() => handleManualHandoff()} className="mt-2 w-full py-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-100 transition">
                    <PhoneCall className="w-3.5 h-3.5" /> Contacter mon consultant
                </button>
            ) : (
                <div className="mt-2 text-center">
                    <button onClick={() => handleManualHandoff()} className="text-xs text-brand-400 hover:text-brand-700 flex items-center justify-center gap-1 mx-auto transition-colors font-medium group">Besoin d'aide humaine ? <span className="underline decoration-dotted group-hover:decoration-brand-700">Alerter mon consultant</span> <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" /></button>
                </div>
            )}
            <p className="text-xs text-slate-500 text-center mt-1">Cet assistant est une intelligence artificielle. Il ne remplace pas l'avis de votre consultant.</p>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatWidget;
