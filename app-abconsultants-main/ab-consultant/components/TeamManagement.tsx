
import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Mail, Shield, ShieldCheck, AlertCircle, Check, Copy, Send, ExternalLink, Edit2, X, ShieldOff } from 'lucide-react';
import { Consultant } from '../types';
import { getConsultants, addConsultant, deleteConsultant, normalizeId, updateConsultant, updateConsultantRole } from '../services/dataService';
import { refreshUserRole } from '../lib/cloudFunctions';
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [promotingId, setPromotingId] = useState<string | null>(null);

    // État pour gérer la confirmation après ajout
    const [lastAdded, setLastAdded] = useState<{name: string, email: string} | null>(null);

    // État pour l'édition
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const confirm = useConfirmDialog();

    // Validation email stricte (RFC-lite, suffisant pour un email pro)
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const isEmailValid = EMAIL_RE.test(newEmail.trim());
    const emailAlreadyExists = consultants.some(c => c.email.toLowerCase() === newEmail.toLowerCase().trim());

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

        if (!newEmail.trim() || !newName.trim()) return;
        if (!isEmailValid) {
            setError("Format d'email invalide. Exemple : jean@ab-conseil.fr");
            return;
        }
        if (emailAlreadyExists) {
            setError("Cet email est déjà dans l'équipe.");
            return;
        }
        if (isSubmitting) return;

        const ok = await confirm({ title: 'Ajouter ce consultant ?', message: `${newName} (${newEmail}) aura accès aux données confidentielles de tous les clients.`, variant: 'default', confirmLabel: 'Autoriser l\'accès' });
        if (!ok) return;

        setIsSubmitting(true);
        try {
            const emailClean = newEmail.toLowerCase().trim();
            const nameClean = newName.trim();
            // On utilise la fonction partagée pour être sûr que l'ID est identique au Login
            const robustId = normalizeId(emailClean);

            const newConsultant: Consultant = {
                id: robustId,
                email: emailClean,
                name: nameClean,
                role: 'consultant',
                addedAt: new Date().toISOString()
            };
            await addConsultant(newConsultant);

            // Succès
            setLastAdded({ name: nameClean, email: emailClean });
            setNewEmail('');
            setNewName('');
            await loadTeam();
        } catch (e) {
            setError("Erreur lors de l'ajout.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (c: Consultant) => {
        if (deletingId) return;
        const ok = await confirm({
            title: `Révoquer l'accès de ${c.name} ?`,
            message: `${c.name} (${c.email}) ne pourra plus se connecter à la plateforme et perdra l'accès à toutes les données clients.\n\nCette action est irréversible.`,
            variant: 'danger',
            confirmLabel: 'Révoquer l\'accès'
        });
        if (!ok) return;
        setDeletingId(c.id);
        try {
            await deleteConsultant(c.id);
            await loadTeam();
        } finally {
            setDeletingId(null);
        }
    };

    const handleToggleRole = async (c: Consultant) => {
        if (promotingId) return;
        const currentRole = c.role === 'admin' ? 'admin' : 'consultant';
        const newRole: 'admin' | 'consultant' = currentRole === 'admin' ? 'consultant' : 'admin';

        const isPromote = newRole === 'admin';
        const ok = await confirm({
            title: isPromote ? `Promouvoir ${c.name} administrateur ?` : `Rétrograder ${c.name} ?`,
            message: isPromote
                ? `${c.name} aura les mêmes droits que vous : gérer l'équipe, supprimer des dossiers, modifier les paramètres globaux. Confirmer ?`
                : `${c.name} ne pourra plus gérer l'équipe ni supprimer des dossiers. Confirmer ?`,
            variant: isPromote ? 'default' : 'danger',
            confirmLabel: isPromote ? 'Promouvoir admin' : 'Rétrograder'
        });
        if (!ok) return;

        setPromotingId(c.id);
        try {
            await updateConsultantRole(c.id, newRole);
            try {
                await refreshUserRole(c.id);
                await loadTeam();
                await confirm({
                    title: isPromote ? 'Promotion effectuée' : 'Rétrogradation effectuée',
                    message: isPromote
                        ? `${c.name} est désormais administrateur.`
                        : `${c.name} est désormais consultant.`,
                    variant: 'success',
                    showCancel: false,
                    confirmLabel: 'OK'
                });
            } catch (claimErr) {
                console.error('Erreur refreshUserRole:', claimErr);
                await loadTeam();
                await confirm({
                    title: 'Rôle partiellement mis à jour',
                    message: `Rôle mis à jour, mais le membre devra se reconnecter manuellement pour que les droits soient appliqués.`,
                    variant: 'danger',
                    showCancel: false,
                    confirmLabel: 'OK'
                });
            }
        } catch (e) {
            console.error('Erreur updateConsultantRole:', e);
            await confirm({
                title: 'Erreur',
                message: "Impossible de modifier le rôle. Vérifiez votre connexion et réessayez.",
                variant: 'danger',
                showCancel: false,
                confirmLabel: 'OK'
            });
        } finally {
            setPromotingId(null);
        }
    };

    const handleResendInvite = (c: Consultant) => {
        const url = window.location.origin;
        const subject = encodeURIComponent(`Activation de votre accès AB Consultants`);
        const body = encodeURIComponent(`Bonjour ${c.name},

Votre accès à la suite de pilotage AB Consultants est prêt.

POUR VOUS CONNECTER :
1. Allez sur : ${url}
2. Sélectionnez l'onglet « Espace Consultant »
3. Cliquez sur « Invité par l'admin ? Activer mon accès »
4. Utilisez votre identifiant : ${c.email}
5. Définissez votre mot de passe

Si vous avez déjà créé votre mot de passe, vous pouvez simplement vous connecter.

À très vite,
L'équipe AB Consultants`);
        window.open(`mailto:${c.email}?subject=${subject}&body=${body}`, '_blank');
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
                <p className="eyebrow mb-2">Pilotage Cabinet</p>
                <h2 className="font-display text-3xl font-semibold text-paper-900 tracking-tight flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-brand-500" /> Mon Équipe
                    <span className="font-sans text-base font-medium text-slate-400 tabular-nums">({consultants.length})</span>
                </h2>
                <p className="text-slate-500 text-sm mt-1">Gérez les accès consultants à la plateforme.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLONNE GAUCHE : LISTE */}
                <div className="lg:col-span-2 space-y-4">
                    {consultants.map(c => {
                        const isMe = c.email === currentUserEmail;
                        const isAdmin = c.role === 'admin';
                        return (
                        <div key={c.id} className={`bg-white p-4 rounded-xl border flex items-center justify-between shadow-sm ${isMe ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isMe ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700'}`}>
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
                                            {isMe && (
                                                <span className="px-2 py-0.5 bg-brand-600 text-white text-xs font-bold rounded-full">Vous</span>
                                            )}
                                            <button onClick={() => handleStartEdit(c)} className="text-slate-300 hover:text-brand-500 transition"><Edit2 className="w-3 h-3"/></button>
                                        </h4>
                                    )}
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <Mail className="w-3 h-3" /> {c.email}
                                        </div>
                                        {/* ID TECHNIQUE POUR DEBUG (Utile si problème de login) */}
                                        <div className="text-xs text-slate-300 font-mono">
                                            ID: {c.id}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                <span
                                    className={`px-2 py-1 text-xs font-bold rounded-full uppercase tracking-wide inline-flex items-center gap-1 ${isAdmin ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
                                    title={isAdmin ? 'Administrateur : accès total et gestion équipe' : 'Consultant : accès aux clients'}
                                >
                                    {isAdmin ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                                    {c.role}
                                </span>
                                {!isMe && (
                                    <>
                                        <button
                                            onClick={() => handleResendInvite(c)}
                                            className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 hover:text-slate-800 transition"
                                            title={`Renvoyer l'invitation à ${c.email}`}
                                            aria-label={`Renvoyer l'invitation à ${c.name}`}
                                        >
                                            <Mail className="w-4 h-4" />
                                            <span className="hidden sm:inline">Renvoyer</span>
                                        </button>
                                        <button
                                            onClick={() => handleToggleRole(c)}
                                            disabled={promotingId === c.id}
                                            className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${isAdmin ? 'border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}`}
                                            title={isAdmin ? `Rétrograder ${c.name} en consultant` : `Promouvoir ${c.name} administrateur`}
                                            aria-label={isAdmin ? `Rétrograder ${c.name}` : `Promouvoir ${c.name} administrateur`}
                                        >
                                            {promotingId === c.id ? (
                                                <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                            ) : isAdmin ? (
                                                <ShieldOff className="w-4 h-4" />
                                            ) : (
                                                <ShieldCheck className="w-4 h-4" />
                                            )}
                                            <span className="hidden sm:inline">{isAdmin ? 'Rétrograder' : 'Promouvoir admin'}</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(c)}
                                            disabled={deletingId === c.id}
                                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={`Révoquer l'accès de ${c.name}`}
                                            aria-label={`Révoquer l'accès de ${c.name}`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        );
                    })}
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
                            <h3 className="font-display text-lg font-semibold text-paper-900 tracking-tight mb-4 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-brand-600" /> Ajouter un membre
                            </h3>
                            <form onSubmit={handleAdd} className="space-y-4">
                                <div>
                                    <label className="eyebrow block mb-1">Nom Complet</label>
                                    <input 
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="Jean Dupont"
                                        className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="eyebrow block mb-1">Email Pro</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        placeholder="jean@ab-conseil.fr"
                                        className={`w-full p-2 rounded-lg border outline-none focus:ring-2 ${newEmail && !isEmailValid ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-brand-500'}`}
                                        aria-invalid={!!newEmail && !isEmailValid}
                                    />
                                    {newEmail && !isEmailValid && (
                                        <div className="text-red-600 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Format invalide. Exemple : jean@ab-conseil.fr</div>
                                    )}
                                    {newEmail && isEmailValid && emailAlreadyExists && (
                                        <div className="text-amber-600 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Cet email est déjà dans l'équipe.</div>
                                    )}
                                </div>
                                {newEmail && isEmailValid && (
                                    <div className="text-xs text-slate-400 font-mono">
                                        ID généré : {normalizeId(newEmail)}
                                    </div>
                                )}
                                {error && <div className="text-red-500 text-xs font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {error}</div>}
                                <button
                                    type="submit"
                                    disabled={!newEmail.trim() || !newName.trim() || !isEmailValid || emailAlreadyExists || isSubmitting}
                                    className="w-full py-2 bg-brand-800 text-white rounded-lg font-bold hover:bg-brand-900 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Ajout en cours...
                                        </>
                                    ) : (
                                        <>Autoriser l'accès</>
                                    )}
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
