
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Send, Shield, User, Bot, Loader2, ShieldCheck, UserCheck, PhoneCall, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
import { Client, ChatMessage, FinancialRecord } from '../types';
import { subscribeToChat, sendMessage, sendConsultantAlertEmail } from '../services/dataService';
import { getFinancialAdvice, generateConversationSummary } from '../services/geminiService';

interface ClientMessagingProps {
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
    { label: "Conseils", query: "Quels conseils peux-tu me donner pour améliorer ma situation ?" },
];

const ClientMessaging: React.FC<ClientMessagingProps> = ({ client, data }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!client.id) return;
    const unsubscribe = subscribeToChat(client.id, (msgs) => {
      // Filter out system summaries (internal consultant notes)
      setMessages(msgs.filter(m => !m.isSystemSummary));
    });
    return () => unsubscribe();
  }, [client.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const visibleMessages = useMemo(() => {
      return messages.filter(m => !m.isSystemSummary);
  }, [messages]);

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

  const handleSend = async (overrideText?: string) => {
    const userText = overrideText || input.trim();
    if (!userText) return;
    setInput('');
    setError(null);
    setLastFailedQuery(null);
    setIsLoading(true);

    try {
        await sendMessage(client.id, userText, 'user');
    } catch (e: any) {
        setError("Impossible d'envoyer le message. Vérifiez votre connexion.");
        setIsLoading(false);
        return;
    }

    // Call AI to generate a response
    try {
        const contextMessages = visibleMessages;
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
        setError("L'assistant n'a pas pu répondre. Vous pouvez réessayer ou contacter votre consultant.");
        setLastFailedQuery(userText);
        try { await sendMessage(client.id, "Désolé, une erreur technique est survenue. Réessayez ou contactez votre consultant.", 'ai'); } catch(err) {}
    } finally {
        setIsLoading(false);
    }
  };

  const handleRetry = () => {
      if (lastFailedQuery) {
          handleSend(lastFailedQuery);
      }
  };

  const handleManualHandoff = async (skipUserMessage = false) => {
      setIsLoading(true);
      setError(null);

      try {
          if (!skipUserMessage) {
            await sendMessage(client.id, "Je souhaite échanger avec mon consultant.", 'user');
            await sendMessage(
                client.id,
                "C'est noté ! Votre consultant a été alerté et reviendra vers vous rapidement. En attendant, n'hésitez pas à continuer à me poser des questions.",
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

  const hasMessages = visibleMessages.length > 0;

  return (
    <div className="h-[calc(100vh-200px)] bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-in fade-in duration-500">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-brand-50 to-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-500" />
              Messagerie
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Posez vos questions — l'assistant IA vous répond instantanément</p>
          </div>
          <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[11px] text-green-700 font-medium">En ligne</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50">
        {/* Welcome state */}
        {!hasMessages && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center mb-4 shadow-sm">
              <Sparkles className="w-8 h-8 text-brand-600" />
            </div>
            <h3 className="font-bold text-slate-700 text-lg mb-1">
              Bonjour{client.managerName ? ` ${client.managerName}` : ''} !
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
              Je suis votre assistant AB Consultants. Posez-moi vos questions sur votre activité, vos finances ou votre gestion.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {QUICK_SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s.query)}
                  className="px-4 py-2 bg-white text-brand-700 text-sm rounded-full border border-brand-200 shadow-sm hover:bg-brand-50 hover:border-brand-300 hover:shadow transition-all font-medium"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {visibleMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>

            {/* Avatar AI */}
            {msg.sender === 'ai' && !msg.isExpertHandoff && (
               <div className="w-8 h-8 rounded-full bg-white border border-brand-200 flex items-center justify-center shadow-sm mr-3 shrink-0 self-end mb-1">
                  <Bot className="w-4 h-4 text-brand-600" />
               </div>
            )}

            {/* Avatar Consultant */}
            {msg.sender === 'consultant' && (
               <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shadow-sm mr-3 shrink-0 self-end mb-1">
                  <ShieldCheck className="w-4 h-4 text-white" />
               </div>
            )}

            <div className={`max-w-[85%] md:max-w-[75%] flex flex-col`}>
              {/* Sender + timestamp */}
              <div className={`flex items-center gap-1.5 mb-1 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {msg.sender === 'user' ? 'Moi' : msg.sender === 'consultant' ? 'Votre Consultant' : 'Assistant IA'}
                </span>
                <span className="text-[10px] text-slate-300">• {formatTime(msg)}</span>
              </div>

              {/* Bubble */}
              <div className={`p-3 md:p-4 rounded-xl text-sm leading-relaxed shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-brand-600 text-white rounded-br-none'
                  : msg.sender === 'consultant'
                    ? 'bg-emerald-50 border border-emerald-200 text-slate-800 rounded-bl-none'
                    : msg.isExpertHandoff
                        ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-900 rounded-bl-none'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
              }`}>
                {/* Consultant header inside bubble */}
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

                {/* Content — render markdown for AI and consultant */}
                {msg.sender === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  renderMessageContent(msg.text)
                )}
              </div>
            </div>

            {/* Avatar User */}
            {msg.sender === 'user' && (
               <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center shadow-sm ml-3 shrink-0 self-end mb-1">
                  <User className="w-4 h-4 text-white" />
               </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start items-end">
            <div className="w-8 h-8 rounded-full bg-white border border-brand-200 flex items-center justify-center shadow-sm mr-3 shrink-0 mb-1">
              <Bot className="w-4 h-4 text-brand-600 animate-pulse" />
            </div>
            <div className="bg-white p-4 rounded-xl rounded-bl-none border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-xs text-slate-400 font-medium">Réflexion en cours...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && !isLoading && (
          <div className="flex justify-center">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3 max-w-md animate-in fade-in duration-300">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs text-red-700">{error}</span>
              {lastFailedQuery && (
                <button onClick={handleRetry} className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 transition shrink-0">
                  <RefreshCw className="w-3 h-3" /> Réessayer
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 md:p-4 border-t border-slate-200 bg-white">
        {/* Quick suggestions when messages exist but user might want guidance */}
        {hasMessages && !isLoading && visibleMessages.length > 0 && visibleMessages.length < 3 && (
            <div className="flex flex-wrap gap-1.5 pb-3">
                {QUICK_SUGGESTIONS.slice(0, 3).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s.query)}
                      disabled={isLoading}
                      className="px-3 py-1.5 bg-brand-50 text-brand-700 text-xs rounded-full border border-brand-200 shadow-sm hover:bg-brand-100 transition font-medium disabled:opacity-50"
                    >
                      {s.label}
                    </button>
                ))}
            </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isLoading ? "L'assistant rédige sa réponse..." : "Écrire un message..."}
            disabled={isLoading}
            className="flex-1 border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm disabled:bg-slate-50 disabled:text-slate-400 transition"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="px-5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition shadow-sm font-bold shrink-0 disabled:opacity-40"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>

        {/* Handoff button */}
        <button
          onClick={() => handleManualHandoff()}
          disabled={isLoading}
          className="mt-2 w-full py-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-100 transition disabled:opacity-50"
        >
            <PhoneCall className="w-3.5 h-3.5" /> Contacter mon consultant directement
        </button>

        <p className="text-[10px] text-slate-400 mt-2 text-center">
          Assistant IA — ne remplace pas l'avis de votre consultant
        </p>
      </div>
    </div>
  );
};

export default ClientMessaging;
