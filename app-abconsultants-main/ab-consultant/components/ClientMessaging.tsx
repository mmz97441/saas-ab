import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Shield, User, Bot } from 'lucide-react';
import { Client, ChatMessage } from '../types';
import { subscribeToChat, sendMessage } from '../services/dataService';

interface ClientMessagingProps {
  client: Client;
}

const ClientMessaging: React.FC<ClientMessagingProps> = ({ client }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
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
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    try {
      await sendMessage(client.id, input, 'user');
      setInput('');
    } catch (e) {
      console.error('Erreur envoi message:', e);
    }
  };

  return (
    <div className="h-[calc(100vh-200px)] bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-in fade-in duration-500">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand-500" />
          Messagerie
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Échangez directement avec votre consultant</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-300">
            <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
            <p className="font-medium text-sm">Aucun message pour le moment</p>
            <p className="text-xs mt-1">Envoyez un message pour démarrer la conversation.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] md:max-w-[75%] p-3 md:p-4 rounded-xl text-sm shadow-sm ${
              msg.sender === 'user'
                ? 'bg-brand-600 text-white rounded-br-none'
                : msg.sender === 'consultant'
                  ? 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                  : 'bg-slate-200 text-slate-700 rounded-bl-none'
            }`}>
              <div className="flex items-center gap-2 mb-1 opacity-70 text-[10px] font-bold uppercase tracking-wider">
                {msg.sender === 'user' && <User className="w-3 h-3" />}
                {msg.sender === 'consultant' && <Shield className="w-3 h-3" />}
                {msg.sender === 'ai' && <Bot className="w-3 h-3" />}
                <span>{msg.sender === 'user' ? 'Moi' : msg.sender === 'consultant' ? 'Mon Consultant' : 'Assistant IA'}</span>
                <span>• {new Date(msg.timestamp?.toMillis?.() || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 md:p-4 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Écrire un message..."
            className="flex-1 border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition shadow-sm font-bold shrink-0 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 text-center">
          Votre consultant recevra votre message directement.
        </p>
      </div>
    </div>
  );
};

export default ClientMessaging;
