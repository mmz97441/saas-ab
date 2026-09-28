
import React, { useState } from 'react';
import { UserPlus, Mail, Shield, Eye, Crown, X, Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { ClientCollaborator, CollaboratorRole, CollaboratorStatus } from '../types';
import { useConfirmDialog } from '../contexts/ConfirmContext';

interface CollaboratorManagerProps {
  collaborators: ClientCollaborator[];
  ownerEmail: string;
  consultantEmail: string;
  onChange: (collaborators: ClientCollaborator[]) => void;
}

const ROLE_CONFIG: Record<CollaboratorRole, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  owner: { label: 'Propriétaire', icon: <Crown className="w-3.5 h-3.5" />, color: 'text-amber-700 bg-amber-50 border-amber-200', description: 'Accès total au dossier' },
  manager: { label: 'Directeur', icon: <Shield className="w-3.5 h-3.5" />, color: 'text-blue-700 bg-blue-50 border-blue-200', description: 'Saisie et consultation' },
  viewer: { label: 'Lecteur', icon: <Eye className="w-3.5 h-3.5" />, color: 'text-paper-700 bg-paper-100 border-paper-200', description: 'Consultation uniquement' },
};

const STATUS_CONFIG: Record<CollaboratorStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: 'En attente', icon: <Clock className="w-3 h-3" />, color: 'text-amber-700 bg-amber-50' },
  active: { label: 'Actif', icon: <CheckCircle className="w-3 h-3" />, color: 'text-emerald-700 bg-emerald-50' },
  revoked: { label: 'Révoqué', icon: <XCircle className="w-3 h-3" />, color: 'text-red-700 bg-red-50' },
};

const CollaboratorManager: React.FC<CollaboratorManagerProps> = ({ collaborators, ownerEmail, consultantEmail, onChange }) => {
  const confirm = useConfirmDialog();
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<CollaboratorRole>('manager');
  const [error, setError] = useState('');

  const activeCollaborators = collaborators.filter(c => c.status === 'active');
  const pendingCollaborators = collaborators.filter(c => c.status === 'pending');
  const revokedCollaborators = collaborators.filter(c => c.status === 'revoked');

  const handleAdd = () => {
    setError('');
    const email = newEmail.toLowerCase().trim();
    const name = newName.trim();

    if (!email || !name) {
      setError('Email et nom sont requis.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Format d\'email invalide.');
      return;
    }

    if (email === ownerEmail.toLowerCase()) {
      setError('Cet email est déjà le propriétaire du dossier.');
      return;
    }

    if (collaborators.some(c => c.email.toLowerCase() === email && c.status !== 'revoked')) {
      setError('Ce collaborateur a déjà accès au dossier.');
      return;
    }

    // If previously revoked, reactivate
    const existingRevoked = collaborators.findIndex(c => c.email.toLowerCase() === email && c.status === 'revoked');
    if (existingRevoked >= 0) {
      const updated = [...collaborators];
      updated[existingRevoked] = {
        ...updated[existingRevoked],
        name,
        role: newRole,
        status: 'pending',
        invitedAt: new Date().toISOString(),
        invitedBy: consultantEmail,
        acceptedAt: undefined,
      };
      onChange(updated);
    } else {
      onChange([
        ...collaborators,
        {
          email,
          name,
          role: newRole,
          invitedAt: new Date().toISOString(),
          invitedBy: consultantEmail,
          status: 'pending',
        },
      ]);
    }

    setNewEmail('');
    setNewName('');
    setNewRole('manager');
  };

  const handleRevoke = async (collab: ClientCollaborator) => {
    const who = collab.name ? `${collab.name} (${collab.email})` : collab.email;
    const isPending = collab.status === 'pending';
    const ok = await confirm(
      isPending
        ? {
            title: "Annuler l'invitation ?",
            message: `Voulez-vous annuler l'invitation envoyée à ${who} ? Il/elle ne pourra plus accepter l'accès à ce dossier.`,
            confirmLabel: "Annuler l'invitation",
            cancelLabel: 'Retour',
            variant: 'danger',
          }
        : {
            title: "Révoquer l'accès ?",
            message: `Voulez-vous révoquer l'accès de ${who} ? Il/elle ne pourra plus consulter ce dossier.`,
            confirmLabel: "Révoquer l'accès",
            cancelLabel: 'Annuler',
            variant: 'danger',
          }
    );
    if (!ok) return;
    onChange(collaborators.map(c =>
      c.email === collab.email ? { ...c, status: 'revoked' as CollaboratorStatus } : c
    ));
  };

  const handleReactivate = (email: string) => {
    onChange(collaborators.map(c =>
      c.email === email ? { ...c, status: 'pending' as CollaboratorStatus, invitedAt: new Date().toISOString() } : c
    ));
  };

  const handleRoleChange = (email: string, role: CollaboratorRole) => {
    onChange(collaborators.map(c =>
      c.email === email ? { ...c, role } : c
    ));
  };

  const handleRemove = async (collab: ClientCollaborator) => {
    const who = collab.name ? `${collab.name} (${collab.email})` : collab.email;
    const ok = await confirm({
      title: 'Supprimer définitivement ?',
      message: `Voulez-vous supprimer définitivement ${who} de la liste des collaborateurs ? Cette action est irréversible et toute trace de cet accès sera retirée du dossier.`,
      confirmLabel: 'Supprimer définitivement',
      cancelLabel: 'Annuler',
      variant: 'danger',
    });
    if (!ok) return;
    onChange(collaborators.filter(c => c.email !== collab.email));
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-paper-200 pb-2">
        <p className="eyebrow text-paper-500">Accès partagé</p>
        <h3 className="font-display text-lg text-paper-900 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-brand-600" /> Collaborateurs
        </h3>
      </div>

      <p className="text-xs text-paper-600">
        Ajoutez des personnes (directeurs, comptables...) qui pourront accéder à ce dossier en plus du propriétaire.
      </p>

      {/* Add form */}
      <div className="bg-paper-100 rounded-lg p-3 space-y-3 border border-paper-200 shadow-paper-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-paper-400" />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setError(''); }}
              placeholder="email@collaborateur.com"
              className="w-full pl-8 pr-3 py-2 rounded-md border border-paper-300 bg-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            />
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setError(''); }}
            placeholder="Nom complet"
            className="w-full px-3 py-2 rounded-md border border-paper-300 bg-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as CollaboratorRole)}
            className="px-3 py-2 rounded-md border border-paper-300 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white"
          >
            <option value="manager">Directeur (saisie + consultation)</option>
            <option value="viewer">Lecteur (consultation seule)</option>
          </select>
          <button
            type="button"
            onClick={handleAdd}
            className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold hover:bg-brand-700 transition flex items-center gap-1.5 whitespace-nowrap shadow-paper-sm"
          >
            <UserPlus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-700 font-medium">{error}</p>
        )}
      </div>

      {/* Active collaborators list */}
      {activeCollaborators.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow text-paper-500">Collaborateurs actifs</p>
          {activeCollaborators.map((collab) => {
            const roleConfig = ROLE_CONFIG[collab.role];
            const statusConfig = STATUS_CONFIG[collab.status];

            return (
              <div
                key={collab.email}
                className="flex items-center gap-3 bg-white rounded-lg p-3 border border-paper-200 shadow-paper-sm hover:border-paper-300 hover:shadow-paper transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-paper-800 truncate">{collab.name}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${roleConfig.color}`}>
                      {roleConfig.icon} {roleConfig.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                      {statusConfig.icon} {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-xs text-paper-500 truncate font-mono">{collab.email}</p>
                  {collab.acceptedAt && (
                    <p className="text-xs text-paper-500">
                      Accepté le {new Date(collab.acceptedAt).toLocaleDateString('fr-FR')}
                      {collab.lastLoginAt && ` · Dernière connexion : ${new Date(collab.lastLoginAt).toLocaleDateString('fr-FR')}`}
                    </p>
                  )}
                </div>

                <select
                  value={collab.role}
                  onChange={(e) => handleRoleChange(collab.email, e.target.value as CollaboratorRole)}
                  className="text-xs px-2 py-1 rounded border border-paper-200 bg-white outline-none focus:ring-1 focus:ring-brand-500"
                  aria-label={`Rôle de ${collab.name}`}
                >
                  <option value="manager">Directeur</option>
                  <option value="viewer">Lecteur</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleRevoke(collab)}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition"
                  title="Révoquer l'accès"
                  aria-label={`Révoquer l'accès de ${collab.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending invitations */}
      {pendingCollaborators.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow text-paper-500">Invitations envoyées</p>
          {pendingCollaborators.map((collab) => {
            const roleConfig = ROLE_CONFIG[collab.role];
            const statusConfig = STATUS_CONFIG[collab.status];

            return (
              <div
                key={collab.email}
                className="flex items-center gap-3 bg-amber-50/40 rounded-lg p-3 border border-dashed border-amber-200 hover:border-amber-300 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-paper-800 truncate">{collab.name}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${roleConfig.color}`}>
                      {roleConfig.icon} {roleConfig.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                      {statusConfig.icon} {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-xs text-paper-500 truncate font-mono">{collab.email}</p>
                  {collab.invitedAt && (
                    <p className="text-xs text-paper-500">
                      Invité le {new Date(collab.invitedAt).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>

                <select
                  value={collab.role}
                  onChange={(e) => handleRoleChange(collab.email, e.target.value as CollaboratorRole)}
                  className="text-xs px-2 py-1 rounded border border-paper-200 bg-white outline-none focus:ring-1 focus:ring-brand-500"
                  aria-label={`Rôle de ${collab.name}`}
                >
                  <option value="manager">Directeur</option>
                  <option value="viewer">Lecteur</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleRevoke(collab)}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition"
                  title="Annuler l'invitation"
                  aria-label={`Annuler l'invitation de ${collab.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Revoked collaborators */}
      {revokedCollaborators.length > 0 && (
        <div className="space-y-1">
          <p className="eyebrow text-paper-500">Accès révoqués</p>
          {revokedCollaborators.map((collab) => (
            <div key={collab.email} className="flex items-center gap-3 bg-paper-100 rounded-lg p-2 border border-paper-200 opacity-70">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-paper-600 line-through">{collab.name}</span>
                <p className="text-xs text-paper-500 font-mono">{collab.email}</p>
              </div>
              <button
                type="button"
                onClick={() => handleReactivate(collab.email)}
                className="p-1.5 text-brand-500 hover:text-brand-700 hover:bg-brand-50 rounded-md transition"
                title="Réactiver"
                aria-label={`Réactiver l'accès de ${collab.name}`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(collab)}
                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition"
                title="Supprimer définitivement"
                aria-label={`Supprimer définitivement ${collab.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeCollaborators.length === 0 && pendingCollaborators.length === 0 && revokedCollaborators.length === 0 && (
        <div className="p-8 text-center animate-in fade-in duration-300">
          <div className="w-14 h-14 mx-auto rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center mb-3">
            <UserPlus className="w-6 h-6 text-brand-500" />
          </div>
          <p className="font-semibold text-sm text-paper-800 mb-1">Aucun collaborateur ajouté</p>
          <p className="text-xs text-paper-500 leading-relaxed">
            Seul le propriétaire a accès à ce dossier. Ajoutez des directeurs ou comptables ci-dessus.
          </p>
        </div>
      )}
    </div>
  );
};

export default CollaboratorManager;
