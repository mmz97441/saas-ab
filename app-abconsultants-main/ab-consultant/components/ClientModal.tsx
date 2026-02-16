
import React, { useState, useEffect } from 'react';
import { X, Building, User, Mail, MapPin, Hash, Save, AlertCircle, ShieldCheck, Phone, Briefcase, Check, Send, Copy, ExternalLink, Power, Archive } from 'lucide-react';
import { Client, Consultant } from '../types';
import { getConsultants } from '../services/dataService';
import { useConfirmDialog } from '../contexts/ConfirmContext';

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
                }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-brand-100 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-brand-50 p-6 border-b border-brand-100 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-brand-900">
                            {showInviteStep ? 'Dossier Créé avec Succès !' : (initialData ? 'Modifier le Dossier' : 'Nouveau Dossier Client')}
                        </h2>
                        <p className="text-sm text-brand-500">
                            {showInviteStep ? 'Prochaine étape : Inviter le client à activer son accès.' : 'Informations administratives et configuration d\'accès.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white rounded-full text-brand-400 hover:text-brand-700 hover:bg-brand-100 transition">
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
                            <h3 className="text-xl font-bold text-slate-800">Tout est prêt pour {formData.companyName}</h3>
                            <p className="text-slate-500 max-w-md mx-auto">
                                L'email <strong>{formData.owner?.email}</strong> est maintenant autorisé sur la Whitelist. Le client doit définir son mot de passe pour accéder à son tableau de bord.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
                            <button 
                                onClick={handleSendEmail}
                                className="flex flex-col items-center justify-center p-4 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition shadow-md group"
                            >
                                <Send className="w-6 h-6 mb-2 group-hover:-translate-y-1 transition-transform" />
                                <span className="font-bold">Envoyer l'email</span>
                                <span className="text-xs opacity-80 mt-1">Ouvre votre messagerie</span>
                            </button>

                            <button 
                                onClick={handleCopyLink}
                                className="flex flex-col items-center justify-center p-4 bg-white border-2 border-brand-100 text-brand-700 rounded-xl hover:border-brand-300 hover:bg-brand-50 transition group"
                            >
                                <Copy className="w-6 h-6 mb-2 text-brand-400 group-hover:text-brand-600 transition-colors" />
                                <span className="font-bold">Copier le message</span>
                                <span className="text-xs opacity-60 mt-1">Pour envoyer par SMS/WhatsApp</span>
                            </button>
                        </div>

                        <div className="pt-6 border-t border-slate-100 w-full flex items-center justify-center gap-6">
                            {initialData && (
                                <button onClick={() => setShowInviteStep(false)} className="text-brand-500 hover:text-brand-700 text-sm font-medium underline">
                                    Retour au dossier
                                </button>
                            )}
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-medium underline">
                                Fermer et revenir à la liste
                            </button>
                        </div>
                    </div>
                ) : (
                    /* --- FORMULAIRE CLASSIQUE --- */
                    <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                        
                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-100">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}

                        <div className="flex gap-4 items-start">
                            {/* SECTION 1: IDENTITÉ ENTREPRISE */}
                            <div className="space-y-4 flex-1">
                                <h3 className="text-xs font-bold text-brand-600 uppercase tracking-wider border-b border-brand-100 pb-2 mb-3 flex items-center gap-2">
                                    <Building className="w-3 h-3" /> Identité Juridique
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Raison Sociale</label>
                                        <div className="relative">
                                            <Building className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                            <input 
                                                type="text"
                                                value={formData.companyName}
                                                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                                                placeholder="EXEMPLE TRANSPORT SAS"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none font-bold text-slate-700"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">SIRET</label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                            <input 
                                                type="text"
                                                value={formData.siret}
                                                onChange={(e) => setFormData({...formData, siret: e.target.value})}
                                                placeholder="14 chiffres"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone Société</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                            <input 
                                                type="text"
                                                value={formData.companyPhone}
                                                onChange={(e) => setFormData({...formData, companyPhone: e.target.value})}
                                                placeholder="01 23 45 67 89"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: ADRESSE */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-brand-600 uppercase tracking-wider border-b border-brand-100 pb-2 mb-3 flex items-center gap-2">
                                <MapPin className="w-3 h-3" /> Localisation
                            </h3>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Adresse (Rue, ZI...)</label>
                                <input 
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                                    placeholder="12 Avenue des Transports"
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code Postal</label>
                                    <input 
                                        type="text"
                                        value={formData.zipCode}
                                        onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                                        placeholder="75000"
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ville</label>
                                    <input 
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                                        placeholder="PARIS"
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SECTION 3: DIRIGEANT & ACCÈS */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-brand-600 uppercase tracking-wider border-b border-brand-100 pb-2 mb-3 flex items-center gap-2">
                                <User className="w-3 h-3" /> Dirigeant & Accès
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom Dirigeant</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="text"
                                            value={formData.managerName}
                                            onChange={(e) => setFormData({...formData, managerName: e.target.value})}
                                            placeholder="Nom Prénom"
                                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mobile Dirigeant</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="text"
                                            value={formData.managerPhone}
                                            onChange={(e) => setFormData({...formData, managerPhone: e.target.value})}
                                            placeholder="06 00 00 00 00"
                                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email de Connexion (Login Client)</label>
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
                                <p className="text-[10px] text-slate-400 mt-1 ml-1">C'est l'identifiant unique que le client utilisera pour activer son accès.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* SECTION CONSULTANT REFERENT */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Consultant Référent (AB)</label>
                                    <div className="relative">
                                        <ShieldCheck className="absolute left-3 top-3 w-4 h-4 text-brand-600" />
                                        <select 
                                            value={formData.assignedConsultantEmail || ''}
                                            onChange={(e) => setFormData({...formData, assignedConsultantEmail: e.target.value})}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none appearance-none bg-white font-medium text-slate-700 cursor-pointer"
                                        >
                                            <option value="">-- Aucun (Visible par tous les admins) --</option>
                                            {consultants.map(c => (
                                                <option key={c.id} value={c.email}>{c.name} ({c.email})</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* SECTION STATUT */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statut Dossier</label>
                                    <div className="relative">
                                        {formData.status === 'active' ? (
                                            <Power className="absolute left-3 top-3 w-4 h-4 text-emerald-500" />
                                        ) : (
                                            <Archive className="absolute left-3 top-3 w-4 h-4 text-amber-500" />
                                        )}
                                        <select 
                                            value={formData.status || 'active'}
                                            onChange={(e) => setFormData({...formData, status: e.target.value as 'active' | 'inactive'})}
                                            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none appearance-none font-bold cursor-pointer ${
                                                formData.status === 'active' 
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 focus:ring-emerald-500' 
                                                : 'border-amber-200 bg-amber-50 text-amber-800 focus:ring-amber-500'
                                            }`}
                                        >
                                            <option value="active">ACTIF (En production)</option>
                                            <option value="inactive">ARCHIVÉ (En veille)</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center gap-3 shrink-0">
                            {/* Bouton renvoyer invitation (uniquement en mode édition) */}
                            {initialData && formData.owner?.email && (
                                <button
                                    type="button"
                                    onClick={() => setShowInviteStep(true)}
                                    className="px-4 py-2 rounded-lg text-brand-600 hover:bg-brand-50 font-bold transition flex items-center gap-2 text-sm border border-brand-200"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    Renvoyer l'invitation
                                </button>
                            )}
                            <div className="flex-1" />
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold transition"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-6 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50"
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
