
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, Send, X, Bot, Loader2, Sparkles, UserCheck, ChevronRight, Scale, Briefcase, ShieldCheck, UserCircle, Bell, Trash2 } from 'lucide-react';
import { Client, FinancialRecord, ChatMessage } from '../types';
import { getFinancialAdvice, generateConversationSummary } from '../services/geminiService';
import { sendMessage, subscribeToChat, sendConsultantAlertEmail } from '../services/dataService';
import { db, auth } from '../firebase'; 
import { collection, writeBatch, getDocs, deleteDoc } from "firebase/firestore";

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
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbMessages, setDbMessages] = useState<ChatMessage[]>([]);
  const [sessionCutoff, setSessionCutoff] = useState<number | null>(null);
  
  // NOUVEAU : On stocke l'ID du dernier message lu localement pour éteindre le badge
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SESSION_TIMEOUT_MS = 90 * 60 * 1000; // 90 minutes

  // LOGIQUE BADGE : S'allume si le dernier message est du consultant ET qu'on ne l'a pas encore "vu" (ouvert)
  const hasUnreadConsultantMessage = useMemo(() => {
      if (dbMessages.length === 0) return false;
      const lastMsg = dbMessages[dbMessages.length - 1];
      
      // C'est un message du consultant ET son ID est différent de celui qu'on a lu en dernier
      return lastMsg.sender === 'consultant' && lastMsg.id !== lastReadMessageId;
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

            // Si le dernier message date de plus de 90min, on coupe la session (peu importe qui a parlé)
            if ((now - lastTime) > SESSION_TIMEOUT_MS) {
                // On met le cutoff à "Maintenant" pour masquer tout ce qui est antérieur
                setSessionCutoff(now);
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

  // FILTRE DES MESSAGES VISIBLES ET DU CONTEXTE IA
  const visibleMessages = useMemo(() => {
      let filtered = dbMessages;

      // 1. Appliquer le cutoff de session (Masque les vieux messages)
      if (sessionCutoff) {
          filtered = dbMessages.filter(m => getMessageTime(m) > sessionCutoff);
      }
      
      // 2. Toujours masquer les messages système interne (résumés)
      filtered = filtered.filter(m => !m.isSystemSummary);

      // Si aucun message récent, afficher le message de bienvenue
      if (filtered.length === 0) {
          return [{
                id: 'welcome-msg',
                text: `Bonjour ${client.managerName || 'Monsieur/Madame'}. Ravi de vous retrouver.\n\nOn fait un point sur la situation financière, RH ou un sujet stratégique aujourd'hui ?`,
                sender: 'ai',
                timestamp: new Date()
            } as ChatMessage];
      }

      return filtered;
  }, [dbMessages, sessionCutoff, client.managerName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages, isOpen]);

  // FONCTION POUR NETTOYER L'HISTORIQUE MANUELLEMENT
  const handleClearHistory = async () => {
      if (!confirm("Voulez-vous effacer l'historique et démarrer une nouvelle conversation ?")) return;
      setSessionCutoff(Date.now()); // Masque localement immédiatement
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input;
    setInput('');
    setIsLoading(true);

    try {
        await sendMessage(client.id, userText, 'user');
    } catch (e: any) {
        setIsLoading(false);
        return; 
    }

    try {
        // IMPORTANT : On n'envoie à l'IA que les messages visibles (session actuelle)
        // Cela empêche l'IA de lire l'historique de la veille
        const contextMessages = visibleMessages.filter(m => m.id !== 'welcome-msg');
        
        const rawAiResponse = await getFinancialAdvice(userText, contextMessages, client, data);
        
        let finalText = rawAiResponse;
        let isAlert = false;

        // Détection du tag [ALERT_HUMAN] généré par le nouveau Prompt
        if (rawAiResponse.includes('[ALERT_HUMAN]')) {
            isAlert = true;
            finalText = rawAiResponse.replace('[ALERT_HUMAN]', '').trim();
            handleManualHandoff(true); 
        }

        await sendMessage(client.id, finalText, 'ai', isAlert);

    } catch (e) {
        try { await sendMessage(client.id, "Erreur connexion IA.", 'ai'); } catch(err) {}
    } finally {
        setIsLoading(false);
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

          const summary = await generateConversationSummary(visibleMessages, client.companyName);
          await sendMessage(client.id, summary, 'ai', false, true); 
          await sendConsultantAlertEmail(client, "Demande de relais (Chat)", `Le client <strong>${client.companyName}</strong> demande de l'aide.<br/><br/><strong>Dernier résumé IA :</strong><br/><pre>${summary}</pre>`);

      } catch (e) {
          console.error("Handoff error", e);
      } finally {
          setIsLoading(false);
      }
  };

  // Fonction de sanitisation pour éviter les injections XSS
  const sanitizeText = (text: string): string => {
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  };

  const renderMessageContent = (text: string) => {
    // Sanitiser le texte avant traitement
    const sanitizedText = sanitizeText(text);

    return sanitizedText.split('\n').map((line, index) => {
        const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
        const cleanLine = isBullet ? line.trim().substring(2) : line;
        const parts = cleanLine.split(/(\*\*.*?\*\*)/g).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-bold text-inherit">{part.slice(2, -2)}</strong>;
            return part;
        });
        if (isBullet) return <div key={index} className="flex gap-2 ml-1 mb-1 items-start"><span className="text-inherit opacity-70 mt-1.5">•</span><span className="flex-1">{parts}</span></div>;
        return <div key={index} className={`min-h-[1em] ${line.trim() === '' ? 'h-2' : 'mb-1'}`}>{parts}</div>;
    });
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
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
             {hasUnreadConsultantMessage ? "1 Message Expert" : "Consultant 360°"}
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
                <h3 className="font-bold text-sm">Consultant Stratégique</h3>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    <p className="text-[10px] text-brand-300">En ligne • Gemini 3 Pro</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
                {/* BOUTON CORBEILLE / RESET */}
                <button onClick={handleClearHistory} className="text-brand-400 hover:text-red-400 p-1 rounded-full hover:bg-white/10 transition" title="Nouvelle conversation">
                    <Trash2 className="w-5 h-5" />
                </button>
                <button onClick={() => setIsOpen(false)} className="text-brand-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-brand-50">
            {visibleMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                
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
                      <div className="text-[10px] font-bold text-accent-600 mb-1 uppercase tracking-wider flex items-center gap-1">
                          <UserCircle className="w-3 h-3" /> Consultant
                      </div>
                  )}

                  {msg.isExpertHandoff && (
                      <div className="flex items-center gap-2 font-bold mb-2 text-emerald-700 border-b border-emerald-200/50 pb-2">
                          <div className="p-1 bg-emerald-100 rounded-full"><UserCheck className="w-3 h-3" /></div>
                          Transmis au consultant
                      </div>
                  )}
                  {msg.sender === 'ai' ? renderMessageContent(msg.text) : msg.text}
                </div>
              </div>
            ))}
            
            {isLoading && (
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
             {visibleMessages.length === 1 && visibleMessages[0].id === 'welcome-msg' && (
                 <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar px-1">
                     <button onClick={() => { setInput("Analyse ma trésorerie."); }} className="whitespace-nowrap px-3 py-1.5 bg-brand-50 text-brand-700 text-xs rounded-full border border-brand-200 shadow-sm">Trésorerie</button>
                     <button onClick={() => { setInput("Quels risques sur mon BFR ?"); }} className="whitespace-nowrap px-3 py-1.5 bg-brand-50 text-brand-700 text-xs rounded-full border border-brand-200 shadow-sm">BFR</button>
                 </div>
            )}
            <div className="flex items-center gap-2 relative">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Votre message..." className="flex-1 bg-brand-50 text-brand-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:bg-white transition-all" />
              <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-3 bg-brand-700 text-white rounded-xl hover:bg-brand-800 disabled:opacity-50 transition-all shadow-md"><Send className="w-4 h-4" /></button>
            </div>
            <div className="mt-2 text-center">
                <button onClick={() => handleManualHandoff()} className="text-[10px] text-brand-400 hover:text-brand-700 flex items-center justify-center gap-1 mx-auto transition-colors font-medium group">Besoin d'aide humaine ? <span className="underline decoration-dotted group-hover:decoration-brand-700">Alerter mon consultant</span> <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatWidget;
