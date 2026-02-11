
import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Mail, Shield, ShieldCheck, AlertCircle, Check, Copy, Send, ExternalLink, Edit2, X } from 'lucide-react';
import { Consultant } from '../types';
import { getConsultants, addConsultant, deleteConsultant, normalizeId, updateConsultant } from '../services/dataService';
import { useConfirmDialog } from '../contexts/ConfirmContext';

interface TeamManagementProps {
    currentUserEmail: string | null;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ currentUserEmail }) => {
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [error, setError] = useState('');
    
    // État pour gérer la confirmation après ajout
    const [lastAdded, setLastAdded] = useState<{name: string, email: string} | null>(null);

    // État pour l'édition
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const confirm = useConfirmDialog();

    useEffect(() => {
        loadTeam();
    }, []);

    const loadTeam = async () => {
        setIsLoading(true);
        const list = await getConsultants();
        setConsultants(list);
        setIsLoading(false);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLastAdded(null);

        if (!newEmail || !newName) return;

        const ok = await confirm({ title: 'Ajouter ce consultant ?', message: `${newName} (${newEmail}) aura accès aux données confidentielles de tous les clients.`, variant: 'default', confirmLabel: 'Autoriser l\'accès' });
        if (!ok) return;

        try {
            const emailClean = newEmail.toLowerCase().trim();
            // On utilise la fonction partagée pour être sûr que l'ID est identique au Login
            const robustId = normalizeId(emailClean);

            const newConsultant: Consultant = {
                id: robustId,
                email: emailClean,
                name: newName,
                role: 'consultant',
                addedAt: new Date().toISOString()
            };
            await addConsultant(newConsultant);
            
            // Succès
            setLastAdded({ name: newName, email: emailClean });
            setNewEmail('');
            setNewName('');
            await loadTeam();
        } catch (e) {
            setError("Erreur lors de l'ajout.");
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirm({ title: 'Révoquer cet accès ?', message: 'Ce consultant ne pourra plus se connecter à la plateforme.\nCette action est irréversible.', variant: 'danger', confirmLabel: 'Révoquer' });
        if (!ok) return;
        await deleteConsultant(id);
        await loadTeam();
    };

    const handleStartEdit = (c: Consultant) => {
        setEditingId(c.id);
        setEditName(c.name);
    };

    const handleSaveEdit = async (id: string) => {
        if (!editName.trim()) return;

        const ok = await confirm({ title: 'Modifier ce consultant ?', message: 'Le nom sera mis à jour dans la plateforme.', confirmLabel: 'Modifier' });
        if (!ok) return;

        try {
            await updateConsultant(id, editName);
            setEditingId(null);
            await loadTeam();
        } catch (e) {
            await confirm({ title: 'Erreur', message: 'Erreur lors de la modification.', variant: 'danger', showCancel: false, confirmLabel: 'OK' });
        }
    };

    // --- LOGIQUE D'INVITATION ---
    const getInviteMessage = (name: string, email: string) => {
        const url = window.location.origin; // URL actuelle de l'app
        return `Bonjour ${name},\n\nTon accès à la plateforme AB Consultants est ouvert.\n\nPour activer ton compte :\n1. Va sur : ${url}\n2. Choisis "Espace Consultant"\n3. Clique sur "Activer mon accès" (en bas)\n4. Utilise ton email : ${email}\n\nÀ tout de suite !`;
    };

    const handleSendMail = async () => {
        if (!lastAdded) return;
        const subject = "Activation accès AB Consultants";
        const body = getInviteMessage(lastAdded.name, lastAdded.email);
        window.location.href = `mailto:${lastAdded.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const handleCopyInvite = async () => {
        if (!lastAdded) return;
        const body = getInviteMessage(lastAdded.name, lastAdded.email);
        try {
            await navigator.clipboard.writeText(body);
            await confirm({ title: 'Copié !', message: 'Le message d\'invitation a été copié dans le presse-papier.', variant: 'success', showCancel: false, confirmLabel: 'OK' });
        } catch (err) {
            await confirm({ title: 'Erreur', message: 'Impossible de copier dans le presse-papier.', variant: 'danger', showCancel: false, confirmLabel: 'OK' });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-brand-500" /> Mon Équipe
                </h2>
                <p className="text-slate-500 text-sm mt-1">Gérez les accès consultants à la plateforme.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLONNE GAUCHE : LISTE */}
                <div className="lg:col-span-2 space-y-4">
                    {consultants.map(c => (
                        <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-700 font-bold">
                                    {c.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    {editingId === c.id ? (
                                        <div className="flex items-center gap-2 mb-1">
                                            <input 
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="border border-slate-300 rounded px-2 py-1 text-sm font-bold"
                                                autoFocus
                                            />
                                            <button onClick={() => handleSaveEdit(c.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4"/></button>
                                            <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X className="w-4 h-4"/></button>
                                        </div>
                                    ) : (
                                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                            {c.name}
                                            <button onClick={() => handleStartEdit(c)} className="text-slate-300 hover:text-brand-500 transition"><Edit2 className="w-3 h-3"/></button>
                                        </h4>
                                    )}
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <Mail className="w-3 h-3" /> {c.email}
                                        </div>
                                        {/* ID TECHNIQUE POUR DEBUG (Utile si problème de login) */}
                                        <div className="text-[10px] text-slate-300 font-mono">
                                            ID: {c.id}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-brand-100 text-brand-800 text-xs font-bold rounded-md uppercase tracking-wide">
                                    {c.role}
                                </span>
                                {c.email !== currentUserEmail && (
                                    <button 
                                        onClick={() => handleDelete(c.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="Révoquer l'accès"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {consultants.length === 0 && !isLoading && (
                        <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-400 italic">Aucun consultant dans l'équipe.</div>
                    )}
                </div>

                {/* COLONNE DROITE : FORMULAIRE & CONFIRMATION */}
                <div className="lg:col-span-1 space-y-4">
                    
                    {/* CONFIRMATION CARD (S'affiche après ajout) */}
                    {lastAdded && (
                        <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200 shadow-sm animate-in zoom-in-95">
                            <div className="flex items-center gap-2 text-emerald-800 font-bold mb-2">
                                <div className="p-1 bg-emerald-200 rounded-full"><Check className="w-4 h-4" /></div>
                                Accès Autorisé !
                            </div>
                            <p className="text-sm text-emerald-700 mb-4">
                                <strong>{lastAdded.name}</strong> est autorisé(e). Envoyez-lui les instructions pour qu'il active son compte.
                            </p>
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={handleSendMail}
                                    className="w-full py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                                >
                                    <Send className="w-4 h-4" /> Ouvrir mon Email
                                </button>
                                <button 
                                    onClick={handleCopyInvite}
                                    className="w-full py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg font-bold hover:bg-emerald-100 transition flex items-center justify-center gap-2"
                                >
                                    <Copy className="w-4 h-4" /> Copier le message
                                </button>
                            </div>
                            <button onClick={() => setLastAdded(null)} className="mt-4 text-xs text-emerald-600 underline text-center w-full">Fermer</button>
                        </div>
                    )}

                    {/* FORMULAIRE D'AJOUT */}
                    {!lastAdded && (
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-6">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-brand-600" /> Ajouter un membre
                            </h3>
                            <form onSubmit={handleAdd} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom Complet</label>
                                    <input 
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="Jean Dupont"
                                        className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Pro</label>
                                    <input 
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        placeholder="jean@ab-conseil.fr"
                                        className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                {newEmail && (
                                    <div className="text-[10px] text-slate-400 font-mono">
                                        ID généré : {normalizeId(newEmail)}
                                    </div>
                                )}
                                {error && <div className="text-red-500 text-xs font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {error}</div>}
                                <button 
                                    type="submit" 
                                    disabled={!newEmail || !newName}
                                    className="w-full py-2 bg-brand-800 text-white rounded-lg font-bold hover:bg-brand-900 transition disabled:opacity-50"
                                >
                                    Autoriser l'accès
                                </button>
                            </form>
                            <div className="mt-4 p-3 bg-brand-50 text-xs text-brand-600 rounded-lg leading-relaxed">
                                <Shield className="w-3 h-3 inline mr-1" />
                                L'invité devra cliquer sur <strong>"Activer mon accès"</strong> (Espace Consultant) lors de sa première visite.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeamManagement;
