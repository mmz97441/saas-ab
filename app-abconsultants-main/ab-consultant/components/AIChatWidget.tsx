
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, X, Bot, Loader2, Sparkles, UserCheck, ShieldCheck, UserCircle, Bell, Trash2, AlertTriangle, PhoneCall, HelpCircle } from 'lucide-react';
import { Client, FinancialRecord, ChatMessage } from '../types';
import { getFinancialAdvice, generateConversationSummary } from '../services/geminiService';
import { useConfirmDialog } from '../contexts/ConfirmContext';
import { sendMessage, subscribeToChat, sendConsultantAlertEmail } from '../services/dataService';

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

const formatTime = (msg: ChatMessage): string => {
    const ms = getMessageTime(msg);
    if (!ms) return '';
    return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const QUICK_SUGGESTIONS = [
    { label: "Ma trésorerie", query: "Comment se porte ma trésorerie ?" },
    { label: "Mon BFR", query: "Peux-tu m'expliquer mon BFR ?" },
    { label: "Mes ratios", query: "Quels sont mes ratios financiers clés ?" },
    { label: "Mes charges", query: "Comment évoluent mes charges de personnel ?" },
];

const AIChatWidget: React.FC<AIChatWidgetProps> = ({ client, data }) => {
  const confirmDialog = useConfirmDialog();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbMessages, setDbMessages] = useState<ChatMessage[]>([]);
  const [sessionCutoff, setSessionCutoff] = useState<number | null>(null);

  // Persist last read message ID in localStorage so it survives page refresh
  const storageKey = `ab-last-read-msg-${client.id}`;
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(() => {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SESSION_TIMEOUT_MS = 90 * 60 * 1000;
  const SESSION_WARNING_MS = 80 * 60 * 1000;
  const [sessionWarning, setSessionWarning] = useState(false);

  // Badge: unread consultant message
  const hasUnreadConsultantMessage = useMemo(() => {
      if (dbMessages.length === 0) return false;
      const lastMsg = dbMessages[dbMessages.length - 1];
      return lastMsg.sender === 'consultant' && lastMsg.id !== lastReadMessageId;
  }, [dbMessages, lastReadMessageId]);

  useEffect(() => {
    if (!client.id) return;

    const unsubscribe = subscribeToChat(client.id, (msgs) => {
        setDbMessages(msgs);

        const realMessages = msgs.filter(m => !m.isSystemSummary);

        if (realMessages.length > 0) {
            const lastMsg = realMessages[realMessages.length - 1];
            const lastTime = getMessageTime(lastMsg);
            const now = Date.now();

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

  // Mark as read when chat opens — persist to localStorage
  useEffect(() => {
      if (isOpen && dbMessages.length > 0) {
          const lastMsg = dbMessages[dbMessages.length - 1];
          setLastReadMessageId(lastMsg.id);
          try { localStorage.setItem(storageKey, lastMsg.id); } catch {}
      }
  }, [isOpen, dbMessages, storageKey]);

  // Auto-open chat when consultant sends a message
  useEffect(() => {
      if (hasUnreadConsultantMessage && !isOpen) {
          setIsOpen(true);
      }
  }, [hasUnreadConsultantMessage]);

  const visibleMessages = useMemo(() => {
      let filtered = dbMessages;

      if (sessionCutoff) {
          filtered = dbMessages.filter(m => getMessageTime(m) > sessionCutoff);
      }

      filtered = filtered.filter(m => !m.isSystemSummary);

      if (filtered.length === 0) {
          return [{
                id: 'welcome-msg',
                text: `Bonjour${client.managerName ? ` ${client.managerName}` : ''} ! Je suis votre assistant AB Consultants.\n\nJe peux vous aider à comprendre vos données financières, répondre à vos questions de gestion, ou vous mettre en relation avec votre consultant.\n\nComment puis-je vous aider ?`,
                sender: 'ai',
                timestamp: new Date()
            } as ChatMessage];
      }

      return filtered;
  }, [dbMessages, sessionCutoff, client.managerName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages, isOpen]);

  const handleClearHistory = async () => {
      const ok = await confirmDialog({ title: 'Nouvelle conversation', message: 'L\'historique sera masqué et une nouvelle session démarrera.', variant: 'danger', confirmLabel: 'Recommencer' });
      if (!ok) return;
      setSessionCutoff(Date.now());
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
        const contextMessages = visibleMessages.filter(m => m.id !== 'welcome-msg');

        const rawAiResponse = await getFinancialAdvice(userText, contextMessages, client, data);

        let finalText = rawAiResponse;
        let isAlert = false;

        if (rawAiResponse.includes('[ALERT_HUMAN]')) {
            isAlert = true;
            finalText = rawAiResponse.replace('[ALERT_HUMAN]', '').trim();
            handleManualHandoff(true);
        }

        await sendMessage(client.id, finalText, 'ai', isAlert);

    } catch (e) {
        try { await sendMessage(client.id, "Désolé, une erreur technique est survenue. Réessayez ou contactez votre consultant.", 'ai'); } catch(err) {}
    } finally {
        setIsLoading(false);
    }
  };

  const handleManualHandoff = async (skipUserMessage = false) => {
      setIsLoading(true);

      try {
          if (!skipUserMessage) {
            await sendMessage(client.id, "Je souhaite échanger avec mon consultant.", 'user');
          }

          if (!skipUserMessage) {
              await sendMessage(
                  client.id,
                  "C'est noté ! Votre consultant a été alerté et reviendra vers vous rapidement. En attendant, n'hésitez pas à continuer à me poser des questions.",
                  'ai',
                  true
              );
          }

          const summary = await generateConversationSummary(visibleMessages, client.companyName);
          await sendMessage(client.id, summary, 'ai', false, true);
          const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          await sendConsultantAlertEmail(client, "Demande de relais (Chat)", `Le client <strong>${esc(client.companyName)}</strong> demande de l'aide.<br/><br/><strong>Dernier résumé IA :</strong><br/><pre>${esc(summary)}</pre>`);

      } catch (e) {
          console.error("Handoff error", e);
      } finally {
          setIsLoading(false);
      }
  };

  const renderMessageContent = (text: string) => {
    return text.split('\n').map((line, index) => {
        const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
        const isNumbered = /^\d+[\.\)]\s/.test(line.trim());
        const cleanLine = isBullet ? line.trim().substring(2) : isNumbered ? line.trim().replace(/^\d+[\.\)]\s/, '') : line;
        const parts = cleanLine.split(/(\*\*.*?\*\*)/g).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-bold text-inherit">{part.slice(2, -2)}</strong>;
            return part;
        });
        if (isBullet) return <div key={index} className="flex gap-2 ml-1 mb-1 items-start"><span className="text-inherit opacity-60 mt-0.5">•</span><span className="flex-1">{parts}</span></div>;
        if (isNumbered) {
            const num = line.trim().match(/^(\d+)[\.\)]/)?.[1];
            return <div key={index} className="flex gap-2 ml-1 mb-1 items-start"><span className="text-inherit opacity-60 font-bold mt-0.5">{num}.</span><span className="flex-1">{parts}</span></div>;
        }
        return <div key={index} className={`min-h-[1em] ${line.trim() === '' ? 'h-2' : 'mb-1'}`}>{parts}</div>;
    });
  };

  const isWelcomeScreen = visibleMessages.length === 1 && visibleMessages[0].id === 'welcome-msg';

  return (
    <>
      {/* FLOATING BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-2 group border
            ${hasUnreadConsultantMessage
                ? 'bg-emerald-600 text-white border-emerald-500 animate-bounce'
                : 'bg-gradient-to-r from-brand-700 to-brand-900 text-white border-brand-600/50'
            }`}
        >
          <div className="relative">
            {hasUnreadConsultantMessage ? (
                <ShieldCheck className="w-6 h-6" />
            ) : (
                <Sparkles className="w-6 h-6 animate-pulse text-accent-500" />
            )}
            {hasUnreadConsultantMessage && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-emerald-600 animate-ping"></span>
            )}
          </div>
          <span className="font-semibold pr-2 hidden group-hover:block whitespace-nowrap overflow-hidden text-sm">
             {hasUnreadConsultantMessage ? "Réponse de votre consultant" : "Assistant AB"}
          </span>
        </button>
      )}

      {/* CHAT WINDOW */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full sm:w-[420px] h-[620px] max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col border border-brand-200 animate-in zoom-in-95 duration-200 overflow-hidden">
          {/* Header */}
          <div className="bg-brand-900 p-4 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-700 to-brand-800 flex items-center justify-center shadow-inner border border-white/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Assistant AB Consultants</h3>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse"></span>
                    <p className="text-[10px] text-brand-300">En ligne</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
                <button onClick={handleClearHistory} className="text-brand-400 hover:text-red-400 p-1.5 rounded-full hover:bg-white/10 transition" title="Nouvelle conversation">
                    <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="text-brand-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition">
                    <X className="w-4 h-4" />
                </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-brand-50">
            {visibleMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>

                {/* Avatar IA */}
                {msg.sender === 'ai' && !msg.isExpertHandoff && (
                   <div className="w-7 h-7 rounded-full bg-white border border-brand-200 flex items-center justify-center shadow-sm mr-2 shrink-0 self-end mb-1">
                      <Bot className="w-3.5 h-3.5 text-brand-600" />
                   </div>
                )}

                {/* Avatar Consultant */}
                {msg.sender === 'consultant' && (
                   <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center shadow-sm mr-2 shrink-0 self-end mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-white" />
                   </div>
                )}

                <div className="max-w-[82%] flex flex-col">
                  {/* Sender label + timestamp */}
                  <div className={`flex items-center gap-1.5 mb-1 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {msg.sender === 'user' ? 'Moi' : msg.sender === 'consultant' ? 'Votre Consultant' : 'Assistant IA'}
                    </span>
                    {msg.id !== 'welcome-msg' && (
                      <span className="text-[10px] text-slate-300">• {formatTime(msg)}</span>
                    )}
                  </div>

                  {/* Message bubble */}
                  <div
                    className={`
                      p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm
                      ${msg.sender === 'user'
                        ? 'bg-brand-700 text-white rounded-br-sm'
                        : msg.sender === 'consultant'
                          ? 'bg-emerald-50 border border-emerald-200 text-slate-800 rounded-bl-sm'
                          : msg.isExpertHandoff
                              ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-900 rounded-bl-sm'
                              : 'bg-white text-slate-600 border border-brand-100 rounded-bl-sm'
                      }
                    `}
                  >
                    {/* Consultant label inside bubble */}
                    {msg.sender === 'consultant' && (
                        <div className="text-[10px] font-bold text-emerald-600 mb-2 flex items-center gap-1.5 border-b border-emerald-100 pb-2">
                            <ShieldCheck className="w-3 h-3" /> Réponse de votre consultant
                        </div>
                    )}

                    {/* Handoff badge */}
                    {msg.isExpertHandoff && (
                        <div className="flex items-center gap-2 font-bold mb-2 text-emerald-700 border-b border-emerald-200/50 pb-2 text-xs">
                            <div className="p-1 bg-emerald-100 rounded-full"><UserCheck className="w-3 h-3" /></div>
                            Votre consultant a été alerté
                        </div>
                    )}

                    {/* Message content — render markdown for AI and consultant */}
                    {msg.sender === 'user' ? msg.text : renderMessageContent(msg.text)}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start items-end">
                <div className="w-7 h-7 rounded-full bg-white border border-brand-100 flex items-center justify-center shadow-sm mr-2 shrink-0 mb-1"><Bot className="w-3.5 h-3.5 text-brand-600 animate-pulse" /></div>
                <div className="bg-white p-3 rounded-2xl rounded-bl-sm border border-brand-100 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
                  <span className="text-xs text-slate-400 font-medium">Réflexion en cours...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer */}
          <div className="p-3 bg-white border-t border-brand-100 shrink-0">
             {/* Session timeout warning */}
             {sessionWarning && (
                 <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2 text-xs text-amber-700 animate-in fade-in duration-200">
                     <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                     <span>Session inactive. Envoyez un message pour continuer.</span>
                 </div>
             )}

             {/* Quick suggestions on welcome screen */}
             {isWelcomeScreen && (
                 <div className="flex flex-wrap gap-1.5 pb-3 px-1">
                     {QUICK_SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setInput(s.query); }}
                          className="px-3 py-1.5 bg-brand-50 text-brand-700 text-xs rounded-full border border-brand-200 shadow-sm hover:bg-brand-100 hover:border-brand-300 transition font-medium"
                        >
                          {s.label}
                        </button>
                     ))}
                 </div>
            )}

            {/* Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Écrire un message..."
                className="flex-1 bg-brand-50 text-brand-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:bg-white transition-all placeholder:text-slate-400"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="p-3 bg-brand-700 text-white rounded-xl hover:bg-brand-800 disabled:opacity-40 transition-all shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Handoff button — always visible */}
            <button
              onClick={() => handleManualHandoff()}
              disabled={isLoading}
              className="mt-2 w-full py-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-100 transition disabled:opacity-50"
            >
                <PhoneCall className="w-3.5 h-3.5" /> Contacter mon consultant
            </button>

            <p className="text-[9px] text-slate-300 text-center mt-1.5">
              Assistant IA — ne remplace pas l'avis de votre consultant
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatWidget;
