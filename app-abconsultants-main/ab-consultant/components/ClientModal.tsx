
import React, { useState, useEffect, useCallback } from 'react';
import { X, Building, User, Mail, MapPin, Hash, Save, AlertCircle, ShieldCheck, Phone, Briefcase, Check, Send, Copy, ExternalLink, Power, Archive, LogIn, Clock, Loader2 } from 'lucide-react';
import { Client, Consultant, ClientCollaborator } from '../types';
import { getConsultants } from '../services/dataService';
import { useConfirmDialog } from '../contexts/ConfirmContext';
import CollaboratorManager from './CollaboratorManager';
import { callSendClientInvitation } from '../lib/cloudFunctions';

interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (clientData: Partial<Client>) => Promise<void>;
    initialData: Client | null;
}

const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState<Partial<Client>>({
        companyName: '',
        managerName: '',
        owner: { name: '', email: '' },
        siret: '',
        address: '',
        zipCode: '',
        city: '',
        companyPhone: '',
        managerPhone: '',
        status: 'active',
        assignedConsultantEmail: ''
    });
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // NOUVEAU : État pour afficher l'écran d'invitation après succès
    const [showInviteStep, setShowInviteStep] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const confirm = useConfirmDialog();

    // Charger la liste des consultants au montage
    useEffect(() => {
        const loadTeam = async () => {
            try {
                const list = await getConsultants();
                setConsultants(list);
            } catch (e) {
                console.error("Erreur chargement consultants", e);
            }
        };
        if (isOpen) loadTeam();
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setShowInviteStep(false); // Reset l'étape d'invitation à l'ouverture
            if (initialData) {
                setFormData(JSON.parse(JSON.stringify(initialData)));
            } else {
                setFormData({
                    companyName: '',
                    managerName: '',
                    owner: { name: '', email: '' },
                    siret: '',
                    address: '',
                    zipCode: '',
                    city: '',
                    companyPhone: '',
                    managerPhone: '',
                    status: 'active',
                    assignedConsultantEmail: '',
                    settings: { showCommercialMargin: true, showFuelTracking: false }
                });
            }
            setError('');
        }
    }, [initialData, isOpen]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!formData.companyName || !formData.owner?.email) {
            setError("Raison sociale et Email sont obligatoires.");
            return;
        }

        // Si c'est une édition, on demande confirmation
        if (initialData) {
            const ok = await confirm({ title: 'Modifier ce dossier ?', message: 'Les informations du dossier seront mises à jour.', confirmLabel: 'Enregistrer' });
            if (!ok) return;
        }

        setIsLoading(true);
        try {
            // Reconstitution de l'objet owner complet si partiel
            const finalData = {
                ...formData,
                owner: {
                    name: formData.managerName || formData.owner?.name || 'Dirigeant',
                    email: formData.owner?.email || ''
                },
                collaborators: formData.collaborators || []
            };
            await onSave(finalData);
            
            // LOGIQUE DE SUCCÈS
            if (initialData) {
                // Si c'était une modification, on ferme juste
                onClose();
            } else {
                // Si c'est une CRÉATION, on montre l'écran d'invitation
                setIsLoading(false);
                setShowInviteStep(true);
            }
        } catch (err) {
            console.error(err);
            setError("Erreur lors de l'enregistrement.");
            setIsLoading(false);
        }
    };

    // --- GÉNÉRATION DU MESSAGE D'INVITATION (PREMIUM STYLE) ---
    const getInviteMessage = () => {
        const url = window.location.origin;
        const manager = formData.managerName ? ` ${formData.managerName}` : '';
        
        return `Cher Partenaire${manager},

Dans le cadre de notre mandat d'accompagnement, nous avons le plaisir de vous confirmer l'ouverture de votre accès sécurisé à la Suite de Pilotage Financier AB Consultants.

Ce portail exclusif vous permet désormais de :
• Suivre vos indicateurs stratégiques en temps réel.
• Transmettre vos données mensuelles via un canal chiffré.
• Échanger confidentiellement avec votre consultant référent.

PROCÉDURE D'ACTIVATION SÉCURISÉE :

1. Accédez au portail : ${url}
2. Sélectionnez le portail "Espace Client".
3. Cliquez sur le lien "Première connexion ? Créer mon accès".
4. Saisissez votre identifiant unique : ${formData.owner?.email}
5. Définissez votre mot de passe personnel.

Note de sécurité : Cet identifiant est strictement personnel. 

Votre consultant référent reste à votre entière disposition pour vous accompagner dans la prise en main de cet outil décisionnel.

Respectueusement,

LA DIRECTION
AB CONSULTANTS
Expertise & Stratégie Financière`;
    };

    const handleSendEmail = () => {
        const subject = `CONFIDENTIEL | Activation de votre Portail Stratégique - ${formData.companyName}`;
        const body = getInviteMessage();
        window.location.href = `mailto:${formData.owner?.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(getInviteMessage());
            await confirm({ title: 'Copié !', message: 'Le message d\'invitation a été copié dans le presse-papier.', variant: 'success', showCancel: false, confirmLabel: 'OK' });
        } catch (e) {
            await confirm({ title: 'Erreur', message: 'Impossible de copier dans le presse-papier.', variant: 'danger', showCancel: false, confirmLabel: 'OK' });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-label={initialData ? 'Modifier le dossier' : 'Nouveau dossier'} onKeyDown={handleKeyDown} className="bg-white rounded-2xl shadow-paper-xl w-full max-w-2xl overflow-hidden border border-paper-200 flex flex-col max-h-[90vh] animate-in zoom-in-95 fade-in duration-300">

                {/* Header */}
                <div className="bg-paper-50 p-6 border-b border-paper-200 flex justify-between items-center shrink-0">
                    <div>
                        <p className="eyebrow text-paper-500 mb-1">{initialData ? 'Édition dossier' : 'Création dossier'}</p>
                        <h2 className="font-display text-xl font-semibold text-brand-900">
                            {showInviteStep ? 'Dossier Créé avec Succès !' : (initialData ? 'Modifier le Dossier' : 'Nouveau Dossier Client')}
                        </h2>
                        <p className="text-sm text-paper-500 mt-0.5">
                            {showInviteStep ? 'Prochaine étape : Inviter le client à activer son accès.' : 'Informations administratives et configuration d\'accès.'}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Fermer la modale" title="Fermer" className="p-2 bg-white rounded-full text-paper-500 hover:text-brand-900 hover:bg-paper-100 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* --- ÉCRAN D'INVITATION (SUCCESS) --- */}
                {showInviteStep ? (
                    <div className="p-8 flex flex-col items-center justify-center space-y-6 text-center animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-2 shadow-sm">
                            <Check className="w-10 h-10 text-emerald-600" />
                        </div>
                        
                        <div className="space-y-2">
                            <h3 className="font-display text-xl font-semibold text-brand-900">Tout est prêt pour {formData.companyName}</h3>
                            <p className="text-paper-600 max-w-md mx-auto">
                                L'email <strong>{formData.owner?.email}</strong> est maintenant autorisé sur la Whitelist. Le client doit définir son mot de passe pour accéder à son tableau de bord.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
                            <button
                                onClick={async () => {
                                    if (!initialData?.id && !formData.id) return;
                                    setSendingEmail(true);
                                    try {
                                        await callSendClientInvitation({ clientId: (initialData?.id || formData.id)!, method: 'email', appUrl: window.location.origin });
                                        setEmailSent(true);
                                        await confirm({ title: 'Invitation envoyée !', message: `L'email d'invitation a été envoyé à ${formData.owner?.email}.`, variant: 'success', showCancel: false, confirmLabel: 'OK' });
                                    } catch {
                                        await confirm({ title: 'Erreur', message: 'Impossible d\'envoyer l\'email. Vérifiez la configuration SMTP.', variant: 'danger', showCancel: false, confirmLabel: 'OK' });
                                    } finally {
                                        setSendingEmail(false);
                                    }
                                }}
                                disabled={sendingEmail}
                                className="flex flex-col items-center justify-center p-4 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition shadow-md group disabled:opacity-50"
                            >
                                {sendingEmail ? (
                                    <Loader2 className="w-6 h-6 mb-2 animate-spin" />
                                ) : emailSent ? (
                                    <Check className="w-6 h-6 mb-2 text-emerald-300" />
                                ) : (
                                    <Mail className="w-6 h-6 mb-2 group-hover:-translate-y-1 transition-transform" />
                                )}
                                <span className="font-bold">{emailSent ? 'Email envoyé !' : 'Envoyer par email'}</span>
                                <span className="text-xs opacity-80 mt-1">Envoi automatique sécurisé</span>
                            </button>

                            <button
                                onClick={async () => {
                                    await handleCopyLink();
                                    if (initialData?.id || formData.id) {
                                        callSendClientInvitation({ clientId: (initialData?.id || formData.id)!, method: 'manual', appUrl: window.location.origin }).catch(() => {});
                                    }
                                }}
                                className="flex flex-col items-center justify-center p-4 bg-white border-2 border-brand-100 text-brand-700 rounded-xl hover:border-brand-300 hover:bg-brand-50 transition group"
                            >
                                <Copy className="w-6 h-6 mb-2 text-brand-400 group-hover:text-brand-600 transition-colors" />
                                <span className="font-bold">Copier le message</span>
                                <span className="text-xs opacity-60 mt-1">Pour envoyer par SMS/WhatsApp</span>
                            </button>
                        </div>

                        <div className="pt-6 border-t border-paper-200 w-full flex items-center justify-center gap-6">
                            {initialData && (
                                <button onClick={() => setShowInviteStep(false)} className="text-brand-600 hover:text-brand-800 text-sm font-medium underline">
                                    Retour au dossier
                                </button>
                            )}
                            <button onClick={onClose} className="text-paper-500 hover:text-paper-700 text-sm font-medium underline">
                                Fermer et revenir à la liste
                            </button>
                        </div>
                    </div>
                ) : (
                    /* --- FORMULAIRE CLASSIQUE --- */
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                        {error && (
                            <div role="alert" className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                            </div>
                        )}

                        <div className="flex gap-4 items-start">
                            {/* SECTION 1: IDENTITÉ ENTREPRISE */}
                            <div className="space-y-4 flex-1">
                                <h3 className="eyebrow text-brand-600 border-b border-paper-200 pb-2 mb-3 flex items-center gap-2">
                                    <Building className="w-3 h-3" /> Identité Juridique
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="eyebrow text-paper-600 mb-1 block">Raison Sociale</label>
                                        <div className="relative">
                                            <Building className="absolute left-3 top-3 w-4 h-4 text-paper-400" />
                                            <input 
                                                type="text"
                                                value={formData.companyName}
                                                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                                                placeholder="EXEMPLE TRANSPORT SAS"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-paper-300 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all font-semibold text-paper-900"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="eyebrow text-paper-600 mb-1 block">SIRET</label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-3 w-4 h-4 text-paper-400" />
                                            <input 
                                                type="text"
                                                value={formData.siret}
                                                onChange={(e) => setFormData({...formData, siret: e.target.value})}
                                                placeholder="14 chiffres"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-paper-300 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-paper-800"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="eyebrow text-paper-600 mb-1 block">Téléphone Société</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-3 w-4 h-4 text-paper-400" />
                                            <input 
                                                type="text"
                                                value={formData.companyPhone}
                                                onChange={(e) => setFormData({...formData, companyPhone: e.target.value})}
                                                placeholder="01 23 45 67 89"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-paper-300 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-paper-800"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: ADRESSE */}
                        <div className="space-y-4">
                            <h3 className="eyebrow text-brand-600 border-b border-paper-200 pb-2 mb-3 flex items-center gap-2">
                                <MapPin className="w-3 h-3" /> Localisation
                            </h3>
                            
                            <div>
                                <label className="eyebrow text-paper-600 mb-1 block">Adresse (Rue, ZI...)</label>
                                <input 
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                                    placeholder="12 Avenue des Transports"
                                    className="w-full px-4 py-2.5 rounded-lg border border-paper-300 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-paper-800"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="eyebrow text-paper-600 mb-1 block">Code Postal</label>
                                    <input 
                                        type="text"
                                        value={formData.zipCode}
                                        onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                                        placeholder="75000"
                                        className="w-full px-4 py-2.5 rounded-lg border border-paper-300 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-paper-800"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="eyebrow text-paper-600 mb-1 block">Ville</label>
                                    <input 
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                                        placeholder="PARIS"
                                        className="w-full px-4 py-2.5 rounded-lg border border-paper-300 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all font-semibold text-paper-900"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SECTION 3: DIRIGEANT & ACCÈS */}
                        <div className="space-y-4">
                            <h3 className="eyebrow text-brand-600 border-b border-paper-200 pb-2 mb-3 flex items-center gap-2">
                                <User className="w-3 h-3" /> Dirigeant & Accès
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="eyebrow text-paper-600 mb-1 block">Nom Dirigeant</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 w-4 h-4 text-paper-400" />
                                        <input 
                                            type="text"
                                            value={formData.managerName}
                                            onChange={(e) => setFormData({...formData, managerName: e.target.value})}
                                            placeholder="Nom Prénom"
                                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-paper-300 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all font-medium text-paper-800"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="eyebrow text-paper-600 mb-1 block">Mobile Dirigeant</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 w-4 h-4 text-paper-400" />
                                        <input 
                                            type="text"
                                            value={formData.managerPhone}
                                            onChange={(e) => setFormData({...formData, managerPhone: e.target.value})}
                                            placeholder="06 00 00 00 00"
                                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-paper-300 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-paper-800"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="eyebrow text-paper-600 mb-1 block">Email de Connexion (Login Client)</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-4 h-4 text-brand-500" />
                                    <input 
                                        type="email"
                                        value={formData.owner?.email}
                                        onChange={(e) => setFormData({...formData, owner: { ...formData.owner!, email: e.target.value }})}
                                        placeholder="email@client.com"
                                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-brand-200 bg-brand-50/50 focus:ring-2 focus:ring-brand-500 outline-none font-bold text-brand-900"
                                    />
                                </div>
                                <p className="text-xs text-paper-500 mt-1 ml-1">C'est l'identifiant unique que le client utilisera pour activer son accès.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* SECTION CONSULTANT REFERENT */}
                                <div>
                                    <label className="eyebrow text-paper-600 mb-1 block">Consultant Référent (AB)</label>
                                    <div className="relative">
                                        <ShieldCheck className="absolute left-3 top-3 w-4 h-4 text-brand-600" />
                                        <select
                                            value={formData.assignedConsultantEmail || ''}
                                            onChange={(e) => setFormData({...formData, assignedConsultantEmail: e.target.value})}
                                            aria-label="Consultant référent"
                                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-paper-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all appearance-none bg-white font-medium text-paper-800 cursor-pointer"
                                        >
                                            <option value="">-- Aucun (Visible par tous les admins) --</option>
                                            {consultants.map(c => (
                                                <option key={c.id} value={c.email}>{c.name} ({c.email})</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-paper-500">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* SECTION STATUT */}
                                <div>
                                    <label className="eyebrow text-paper-600 mb-1 block">Statut Dossier</label>
                                    <div className="relative">
                                        {formData.status === 'active' ? (
                                            <Power className="absolute left-3 top-3 w-4 h-4 text-emerald-500" />
                                        ) : (
                                            <Archive className="absolute left-3 top-3 w-4 h-4 text-amber-500" />
                                        )}
                                        <select
                                            value={formData.status || 'active'}
                                            onChange={(e) => setFormData({...formData, status: e.target.value as 'active' | 'inactive'})}
                                            aria-label="Statut du dossier"
                                            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none appearance-none font-bold cursor-pointer focus:ring-2 ${
                                                formData.status === 'active'
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 focus:ring-emerald-500'
                                                : 'border-amber-200 bg-amber-50 text-amber-800 focus:ring-amber-500'
                                            }`}
                                        >
                                            <option value="active">ACTIF (En production)</option>
                                            <option value="inactive">ARCHIVÉ (En veille)</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-paper-500">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 4: SUIVI CONNEXION (mode édition uniquement) */}
                        {initialData && (
                            <div className="space-y-3">
                                <h3 className="eyebrow text-brand-600 border-b border-paper-200 pb-2 mb-3 flex items-center gap-2">
                                    <LogIn className="w-3 h-3" /> Suivi Connexion
                                </h3>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Statut */}
                                    <div className="bg-paper-50 rounded-lg p-3 border border-paper-200">
                                        <p className="eyebrow text-paper-500 mb-1">Statut</p>
                                        {initialData.owner?.lastLoginAt ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Connecté
                                            </span>
                                        ) : initialData.invitationStatus?.lastSentAt ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700">
                                                <span className="w-2 h-2 rounded-full bg-red-500" /> Jamais connecté
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                                                <span className="w-2 h-2 rounded-full bg-slate-400" /> Non invité
                                            </span>
                                        )}
                                    </div>

                                    {/* Date inscription */}
                                    <div className="bg-paper-50 rounded-lg p-3 border border-paper-200">
                                        <p className="eyebrow text-paper-500 mb-1">Inscription</p>
                                        <p className="text-xs font-semibold text-paper-800 font-mono">
                                            {initialData.owner?.registeredAt
                                                ? new Date(initialData.owner.registeredAt).toLocaleDateString('fr-FR')
                                                : '—'}
                                        </p>
                                    </div>

                                    {/* Dernière connexion */}
                                    <div className="bg-paper-50 rounded-lg p-3 border border-paper-200">
                                        <p className="eyebrow text-paper-500 mb-1">Dernière Connexion</p>
                                        <p className="text-xs font-semibold text-paper-800 font-mono">
                                            {initialData.owner?.lastLoginAt
                                                ? new Date(initialData.owner.lastLoginAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                : '—'}
                                        </p>
                                    </div>

                                    {/* Nombre de connexions */}
                                    <div className="bg-paper-50 rounded-lg p-3 border border-paper-200">
                                        <p className="eyebrow text-paper-500 mb-1">Nb Connexions</p>
                                        <p className="text-xs font-semibold text-paper-800 font-mono">
                                            {initialData.owner?.loginCount ?? 0}
                                        </p>
                                    </div>
                                </div>

                                {/* Invitation status */}
                                {initialData.invitationStatus?.lastSentAt && (
                                    <div className="flex items-center gap-2 text-xs text-paper-600 bg-paper-50 rounded-lg px-3 py-2 border border-paper-200">
                                        <Mail className="w-3 h-3" />
                                        <span>
                                            Dernière invitation envoyée le {new Date(initialData.invitationStatus.lastSentAt).toLocaleDateString('fr-FR')}
                                            {initialData.invitationStatus.sentBy && ` par ${initialData.invitationStatus.sentBy.split('@')[0]}`}
                                            {(initialData.invitationStatus.sentCount || 0) > 1 && ` (${initialData.invitationStatus.sentCount} envois)`}
                                            {initialData.invitationStatus.method === 'email' && ' — via email automatique'}
                                            {initialData.invitationStatus.method === 'manual' && ' — envoi manuel'}
                                        </span>
                                    </div>
                                )}

                                {/* Login history (if available) */}
                                {initialData.owner?.loginHistory && initialData.owner.loginHistory.length > 0 && (
                                    <details className="text-xs">
                                        <summary className="text-paper-500 cursor-pointer hover:text-paper-700 font-medium">
                                            Historique des connexions ({initialData.owner.loginHistory.length})
                                        </summary>
                                        <div className="mt-2 space-y-1 ml-2">
                                            {initialData.owner.loginHistory.map((entry, i) => (
                                                <div key={i} className="flex items-center gap-2 text-paper-600 font-mono">
                                                    <Clock className="w-3 h-3 text-paper-400" />
                                                    <span>{new Date(entry.timestamp).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        )}

                        {/* SECTION 5: COLLABORATEURS */}
                        <CollaboratorManager
                            collaborators={formData.collaborators || []}
                            ownerEmail={formData.owner?.email || ''}
                            consultantEmail={consultants[0]?.email || 'admin@ab-consultants.fr'}
                            onChange={(collabs) => setFormData({ ...formData, collaborators: collabs })}
                        />

                        </div>

                        {/* Footer sticky — dock visuel des CTA */}
                        <div className="shrink-0 px-6 py-4 border-t border-paper-200 bg-paper-50/80 backdrop-blur-sm flex items-center gap-3">
                            {/* Bouton renvoyer invitation (uniquement en mode édition) */}
                            {initialData && formData.owner?.email && (
                                <button
                                    type="button"
                                    onClick={() => setShowInviteStep(true)}
                                    className="px-4 py-2 rounded-lg text-brand-700 hover:bg-paper-100 font-bold transition flex items-center gap-2 text-sm border border-paper-300"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    Renvoyer l'invitation
                                </button>
                            )}
                            <div className="flex-1" />
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-paper-700 hover:bg-paper-100 font-bold transition"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-6 py-2 rounded-lg bg-brand-900 text-white hover:bg-brand-800 font-bold shadow-paper-md hover:shadow-paper-lg transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? 'Enregistrement...' : <><Save className="w-4 h-4" /> Enregistrer le dossier</>}
                            </button>
                        </div>

                    </form>
                )}
            </div>
        </div>
    );
};

export default ClientModal;
