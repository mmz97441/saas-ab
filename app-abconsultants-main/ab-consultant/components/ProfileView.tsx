import React, { useState } from 'react';
import { User, Lock, Mail, Save, CheckCircle, AlertCircle, Moon, Sun, Eye, EyeOff } from 'lucide-react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';

interface ProfileViewProps {
  currentUserEmail: string | null;
  userRole: 'ab_consultant' | 'client';
  clientName?: string;
}

const ProfileView: React.FC<ProfileViewProps> = ({ currentUserEmail, userRole, clientName }) => {
  const { theme, toggleTheme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
      return;
    }

    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('Non connecté');

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setStatus({ type: 'success', message: 'Mot de passe modifié avec succès.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setStatus({ type: 'error', message: 'Mot de passe actuel incorrect.' });
      } else if (err.code === 'auth/weak-password') {
        setStatus({ type: 'error', message: 'Mot de passe trop faible (6 caractères min).' });
      } else {
        setStatus({ type: 'error', message: 'Erreur lors du changement de mot de passe.' });
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <User className="w-6 h-6 text-brand-500" /> Mon Profil
      </h2>

      {/* Informations */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-bold text-slate-700 mb-4">Informations du compte</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Mail className="w-4 h-4 text-brand-500" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
              <p className="text-sm font-medium text-slate-700">{currentUserEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <User className="w-4 h-4 text-brand-500" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Rôle</p>
              <p className="text-sm font-medium text-slate-700">
                {userRole === 'ab_consultant' ? 'Consultant AB' : `Client${clientName ? ` - ${clientName}` : ''}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Apparence */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-bold text-slate-700 mb-4">Apparence</h3>
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <div>
              <p className="text-sm font-medium text-slate-700">Mode sombre</p>
              <p className="text-xs text-slate-400">Réduire la luminosité de l'interface</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Changer le mot de passe
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mot de passe actuel</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nouveau mot de passe</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmer le mot de passe</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1"
          >
            {showPasswords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showPasswords ? 'Masquer' : 'Afficher'} les mots de passe
          </button>

          {status && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {status.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> {isLoading ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileView;
