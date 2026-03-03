
import React, { useState } from 'react';
import { UserPlus, Mail, Shield, Eye, Crown, X, Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { ClientCollaborator, CollaboratorRole, CollaboratorStatus } from '../types';

interface CollaboratorManagerProps {
  collaborators: ClientCollaborator[];
  ownerEmail: string;
  consultantEmail: string;
  onChange: (collaborators: ClientCollaborator[]) => void;
}

const ROLE_CONFIG: Record<CollaboratorRole, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  owner: { label: 'Propriétaire', icon: <Crown className="w-3.5 h-3.5" />, color: 'text-amber-600 bg-amber-50 border-amber-200', description: 'Accès total au dossier' },
  manager: { label: 'Directeur', icon: <Shield className="w-3.5 h-3.5" />, color: 'text-blue-600 bg-blue-50 border-blue-200', description: 'Saisie et consultation' },
  viewer: { label: 'Lecteur', icon: <Eye className="w-3.5 h-3.5" />, color: 'text-slate-600 bg-slate-50 border-slate-200', description: 'Consultation uniquement' },
};

const STATUS_CONFIG: Record<CollaboratorStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: 'En attente', icon: <Clock className="w-3 h-3" />, color: 'text-amber-600 bg-amber-50' },
  active: { label: 'Actif', icon: <CheckCircle className="w-3 h-3" />, color: 'text-emerald-600 bg-emerald-50' },
  revoked: { label: 'Révoqué', icon: <XCircle className="w-3 h-3" />, color: 'text-red-600 bg-red-50' },
};

const CollaboratorManager: React.FC<CollaboratorManagerProps> = ({ collaborators, ownerEmail, consultantEmail, onChange }) => {
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<CollaboratorRole>('manager');
  const [error, setError] = useState('');

  const activeCollaborators = collaborators.filter(c => c.status !== 'revoked');
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

  const handleRevoke = (email: string) => {
    onChange(collaborators.map(c =>
      c.email === email ? { ...c, status: 'revoked' as CollaboratorStatus } : c
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

  const handleRemove = (email: string) => {
    onChange(collaborators.filter(c => c.email !== email));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-brand-600 uppercase tracking-wider border-b border-brand-100 pb-2 flex items-center gap-2">
        <UserPlus className="w-3 h-3" /> Collaborateurs
      </h3>

      <p className="text-xs text-slate-500">
        Ajoutez des personnes (directeurs, comptables...) qui pourront accéder à ce dossier en plus du propriétaire.
      </p>

      {/* Add form */}
      <div className="bg-slate-50 rounded-lg p-3 space-y-3 border border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setError(''); }}
              placeholder="email@collaborateur.com"
              className="w-full pl-8 pr-3 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            />
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setError(''); }}
            placeholder="Nom complet"
            className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as CollaboratorRole)}
            className="px-3 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white"
          >
            <option value="manager">Directeur (saisie + consultation)</option>
            <option value="viewer">Lecteur (consultation seule)</option>
          </select>
          <button
            type="button"
            onClick={handleAdd}
            className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold hover:bg-brand-700 transition flex items-center gap-1.5 whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 font-medium">{error}</p>
        )}
      </div>

      {/* Active collaborators list */}
      {activeCollaborators.length > 0 && (
        <div className="space-y-2">
          {activeCollaborators.map((collab) => {
            const roleConfig = ROLE_CONFIG[collab.role];
            const statusConfig = STATUS_CONFIG[collab.status];

            return (
              <div
                key={collab.email}
                className="flex items-center gap-3 bg-white rounded-lg p-3 border border-slate-100 hover:border-slate-200 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800 truncate">{collab.name}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleConfig.color}`}>
                      {roleConfig.icon} {roleConfig.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.color}`}>
                      {statusConfig.icon} {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{collab.email}</p>
                  {collab.acceptedAt && (
                    <p className="text-[10px] text-slate-400">
                      Accepté le {new Date(collab.acceptedAt).toLocaleDateString('fr-FR')}
                      {collab.lastLoginAt && ` · Dernière connexion : ${new Date(collab.lastLoginAt).toLocaleDateString('fr-FR')}`}
                    </p>
                  )}
                </div>

                <select
                  value={collab.role}
                  onChange={(e) => handleRoleChange(collab.email, e.target.value as CollaboratorRole)}
                  className="text-xs px-2 py-1 rounded border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="manager">Directeur</option>
                  <option value="viewer">Lecteur</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleRevoke(collab.email)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                  title="Révoquer l'accès"
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
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accès révoqués</p>
          {revokedCollaborators.map((collab) => (
            <div key={collab.email} className="flex items-center gap-3 bg-slate-50 rounded-lg p-2 border border-slate-100 opacity-60">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-500 line-through">{collab.name}</span>
                <p className="text-xs text-slate-400">{collab.email}</p>
              </div>
              <button
                type="button"
                onClick={() => handleReactivate(collab.email)}
                className="p-1.5 text-brand-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition"
                title="Réactiver"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(collab.email)}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                title="Supprimer définitivement"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeCollaborators.length === 0 && revokedCollaborators.length === 0 && (
        <p className="text-xs text-slate-400 italic text-center py-2">
          Aucun collaborateur ajouté. Seul le propriétaire a accès à ce dossier.
        </p>
      )}
    </div>
  );
};

export default CollaboratorManager;
