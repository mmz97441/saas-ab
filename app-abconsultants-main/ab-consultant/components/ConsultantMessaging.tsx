
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, User, Clock, AlertTriangle, CheckCircle, Shield, FileText, Bot, ArrowLeft, Zap, Search, X } from 'lucide-react';
import { Client, ChatMessage } from '../types';
import { subscribeToChat, sendMessage, markConversationAsRead } from '../services/dataService';
import { useConfirmDialog } from '../contexts/ConfirmContext';

const QUICK_REPLIES = [
    { label: "Reçu", text: "Bien reçu, merci ! Je traite votre demande." },
    { label: "RDV", text: "Je vous propose un rendez-vous pour en discuter. Quelles sont vos disponibilités cette semaine ?" },
    { label: "Documents", text: "Pourriez-vous me transmettre les documents suivants :\n- Bilan intermédiaire\n- Relevés bancaires du mois\n- Tableau de suivi des factures" },
    { label: "Analyse", text: "J'ai analysé vos chiffres. Voici mes observations :\n\n" },
];

interface ConsultantMessagingProps {
    clients: Client[];
    onMarkAsRead: (clientId: string) => void;
}

const ConsultantMessaging: React.FC<ConsultantMessagingProps> = ({ clients, onMarkAsRead }) => {
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [replyInput, setReplyInput] = useState('');
    const [showTemplates, setShowTemplates] = useState(false);
    const [chatSearch, setChatSearch] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const confirmDialog = useConfirmDialog();

    // FILTRE ET TRI DE LA LISTE DES CONVERSATIONS
    // 1. Filtre : On garde les clients qui ont un historique (lastMessageTime) OU des non-lus OU qui sont sélectionnés.
    //    Ainsi, même après lecture, le client reste dans la liste tant qu'il a parlé.
    // 2. Tri : Strictement chronologique (le plus récent en haut), peu importe le statut de lecture.
    const activeClients = clients
        .filter(c => c.lastMessageTime || c.hasUnreadMessages || c.id === selectedClientId)
        .sort((a, b) => {
             // Tri par date du dernier message (Timestamp Firestore ou Date)
             const timeA = a.lastMessageTime?.toMillis?.() || (a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0);
             const timeB = b.lastMessageTime?.toMillis?.() || (b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0);
             return timeB - timeA; // Plus récent en premier
        });

    useEffect(() => {
        if (!selectedClientId) {
            setMessages([]);
            return;
        }

        // MARQUER COMME LU QUAND ON OUVRE (DB + LOCAL)
        markConversationAsRead(selectedClientId);
        onMarkAsRead(selectedClientId);

        const unsubscribe = subscribeToChat(selectedClientId, (msgs) => {
            setMessages(msgs);
        });
        return () => unsubscribe();
    }, [selectedClientId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendReply = async () => {
        if (!selectedClientId || !replyInput.trim()) return;
        try {
            await sendMessage(selectedClientId, replyInput, 'consultant');
            setReplyInput('');
            // Pas besoin de rafraichir ici, le onSnapshot mettra à jour la liste des messages
        } catch (e) {
            confirmDialog({ title: 'Erreur', message: 'Le message n\'a pas pu être envoyé. Veuillez réessayer.', variant: 'danger', showCancel: false, confirmLabel: 'OK' });
        }
    };

    // Filter conversations by search
    const filteredClients = chatSearch.trim()
        ? activeClients.filter(c => c.companyName.toLowerCase().includes(chatSearch.toLowerCase()) || (c.managerName || '').toLowerCase().includes(chatSearch.toLowerCase()))
        : activeClients;

    return (
        <div className="h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-slate-200 flex overflow-hidden animate-in fade-in duration-500">

            {/* LEFT SIDEBAR: LISTE DES CONVERSATIONS */}
            <div className={`${selectedClientId ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 border-r border-slate-200 flex-col bg-slate-50`}>
                <div className="p-4 border-b border-slate-200 bg-white">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-brand-500" /> Messagerie
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">{activeClients.length} conversation(s) active(s)</p>
                    {/* Search conversations */}
                    <div className="relative mt-2">
                        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={chatSearch}
                            onChange={(e) => setChatSearch(e.target.value)}
                            placeholder="Rechercher..."
                            className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                        {chatSearch && (
                            <button onClick={() => setChatSearch('')} aria-label="Effacer la recherche" className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredClients.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">{chatSearch ? 'Aucun résultat.' : 'Aucun message en attente.'}</p>
                        </div>
                    ) : (
                        filteredClients.map(client => (
                            <button
                                key={client.id}
                                onClick={() => setSelectedClientId(client.id)}
                                className={`w-full text-left p-4 border-b border-slate-100 hover:bg-white transition-colors flex items-start gap-3 ${selectedClientId === client.id ? 'bg-white border-l-4 border-l-brand-600 shadow-sm' : 'border-l-4 border-l-transparent'}`}
                            >
                                <div className={`relative w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${client.hasUnreadMessages ? 'bg-brand-600' : 'bg-slate-300'}`}>
                                    {client.companyName.substring(0, 2).toUpperCase()}
                                    {client.hasUnreadMessages && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>}
                                </div>
                                <div className="overflow-hidden w-full">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <h4 className="font-bold text-sm text-slate-800 truncate pr-2">{client.companyName}</h4>
                                        {client.lastMessageTime && (
                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                {new Date(client.lastMessageTime?.toMillis?.() || Date.now()).toLocaleDateString([], {day:'2-digit', month:'2-digit'})}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">{client.managerName}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT MAIN: CHAT WINDOW */}
            <div className={`${selectedClientId ? 'flex' : 'hidden md:flex'} w-full md:w-2/3 flex-col bg-white`}>
                {selectedClientId ? (
                    <>
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                {/* Mobile back button */}
                                <button onClick={() => setSelectedClientId(null)} aria-label="Retour aux conversations" className="md:hidden p-1.5 hover:bg-slate-100 rounded-lg transition">
                                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                                </button>
                                <span className="font-bold text-slate-700">
                                    {clients.find(c => c.id === selectedClientId)?.companyName}
                                </span>
                            </div>
                            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-1 rounded font-bold hidden sm:inline">Mode Expert</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>

                                    {/* MESSAGE SYSTÈME (RÉSUMÉ) */}
                                    {msg.isSystemSummary ? (
                                        <div className="w-full max-w-2xl mx-auto my-4 bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-sm">
                                            <div className="flex items-center gap-2 mb-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                                                <Bot className="w-4 h-4" /> Briefing Automatique (Caché au client)
                                            </div>
                                            <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed font-mono text-[11px]">
                                                {msg.text}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`max-w-[85%] md:max-w-[80%] p-3 md:p-4 rounded-xl text-sm shadow-sm ${
                                            msg.sender === 'user'
                                                ? 'bg-white border border-slate-200 text-slate-700 rounded-br-none'
                                                : msg.sender === 'consultant'
                                                    ? 'bg-brand-600 text-white rounded-bl-none'
                                                    : 'bg-slate-200 text-slate-700 rounded-bl-none'
                                        }`}>
                                            {/* Header du message */}
                                            <div className="flex items-center gap-2 mb-1 opacity-70 text-[10px] font-bold uppercase tracking-wider">
                                                {msg.sender === 'user' && <User className="w-3 h-3" />}
                                                {msg.sender === 'consultant' && <Shield className="w-3 h-3" />}
                                                {msg.sender === 'ai' && <Bot className="w-3 h-3" />}
                                                <span>{msg.sender === 'user' ? 'Client' : msg.sender === 'consultant' ? 'Moi' : 'IA'}</span>
                                                <span>• {new Date(msg.timestamp?.toMillis?.() || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <div className="whitespace-pre-wrap">{msg.text}</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-3 md:p-4 border-t border-slate-200 bg-white">
                            {/* Quick Reply Templates */}
                            {showTemplates && (
                                <div className="mb-3 flex flex-wrap gap-1.5 animate-in fade-in duration-150">
                                    {QUICK_REPLIES.map((tmpl, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => { setReplyInput(prev => prev + tmpl.text); setShowTemplates(false); }}
                                            className="px-2.5 py-1 bg-brand-50 text-brand-700 text-[11px] font-bold rounded-full border border-brand-200 hover:bg-brand-100 transition"
                                        >
                                            {tmpl.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowTemplates(!showTemplates)}
                                    className={`p-3 rounded-lg border transition shrink-0 ${showTemplates ? 'bg-brand-100 text-brand-700 border-brand-200' : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-brand-600 hover:bg-brand-50'}`}
                                    title="Réponses rapides"
                                >
                                    <Zap className="w-4 h-4" />
                                </button>
                                <input
                                    type="text"
                                    value={replyInput}
                                    onChange={(e) => setReplyInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                                    placeholder="Répondre au client..."
                                    className="flex-1 border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                                />
                                <button onClick={handleSendReply} className="px-4 md:px-6 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition shadow-sm font-bold shrink-0">
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 text-center items-center justify-center gap-1 hidden md:flex">
                                <Shield className="w-3 h-3" /> Votre réponse apparaîtra directement dans le chat du client.
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                        <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                        <p className="font-medium">Sélectionnez une conversation</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConsultantMessaging;
