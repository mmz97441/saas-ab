
import React, { useState } from 'react';
import { ShieldCheck, UserCircle, ArrowRight, Loader2, AlertCircle, Building, Mail, Lock, UserPlus, KeyRound } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { checkClientEmailExists, checkConsultantEmailExists } from '../services/dataService';
import { APP_VERSION } from '../types';

interface LoginScreenProps {
  onLogin: (role: 'ab_consultant' | 'client', email?: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'client' | 'expert'>('client');
  const [isSignUp, setIsSignUp] = useState(false); // Mode Inscription vs Connexion
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Rate limiting côté client : protection contre brute force
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutMessage, setLockoutMessage] = useState('');

  // Email de l'expert (Admin Suprême) - Utilise variable d'env avec fallback
  const EXPERT_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL || "admin@ab-consultants.fr";

  // Vérifier si le compte est temporairement bloqué
  const isLockedOut = (): boolean => {
    if (!lockoutUntil) return false;
    if (Date.now() < lockoutUntil) return true;
    // Le délai est passé, on réinitialise
    setLockoutUntil(null);
    setLockoutMessage('');
    return false;
  };

  // Calculer le délai de blocage (exponentiel : 2s, 4s, 8s, 16s, 30s max)
  const calculateLockoutDelay = (attempts: number): number => {
    const baseDelay = 2000; // 2 secondes
    const maxDelay = 30000; // 30 secondes max
    const delay = Math.min(baseDelay * Math.pow(2, attempts - 1), maxDelay);
    return delay;
  };

  // Enregistrer une tentative échouée
  const recordFailedAttempt = () => {
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);

    if (newAttempts >= 3) { // Après 3 échecs, on active le rate limiting
      const delay = calculateLockoutDelay(newAttempts - 2);
      const unlockTime = Date.now() + delay;
      setLockoutUntil(unlockTime);
      setLockoutMessage(`Trop de tentatives. Réessayez dans ${Math.ceil(delay / 1000)} secondes.`);
    }
  };

  // Réinitialiser après succès
  const resetFailedAttempts = () => {
    setFailedAttempts(0);
    setLockoutUntil(null);
    setLockoutMessage('');
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    // Vérifier le rate limiting avant toute action
    if (isLockedOut()) {
      const remainingTime = Math.ceil((lockoutUntil! - Date.now()) / 1000);
      setError(`Compte temporairement bloqué. Réessayez dans ${remainingTime} secondes.`);
      return;
    }

    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      let userCredential;

      // 1. STRATÉGIE "AUTH FIRST" (SÉCURITÉ MAXIMALE)
      // On s'authentifie D'ABORD au niveau de Google Identity Platform.
      // Cela permet de passer les règles de sécurité Firestore (request.auth != null).
      
      try {
          if (isSignUp) {
              userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          } else {
              userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
          }
      } catch (authErr: any) {
          // Gestion fine des erreurs d'authentification pure
          if (authErr.code === 'auth/email-already-in-use') throw new Error("EMAIL_TAKEN");
          if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/user-not-found' || authErr.code === 'auth/wrong-password') throw new Error("BAD_CREDS");
          if (authErr.code === 'auth/weak-password') throw new Error("WEAK_PASSWORD");
          if (authErr.code === 'auth/too-many-requests') throw new Error("BLOCKED");
          throw authErr;
      }

      // À ce stade, l'utilisateur est techniquement connecté.
      // MAINTENANT, on vérifie s'il a le droit d'entrer dans l'application métier.
      
      try {
          if (activeTab === 'expert') {
              // --- VÉRIFICATION CONSULTANT ---
              let isWhitelisted = false;
              
              if (cleanEmail === EXPERT_EMAIL) {
                  isWhitelisted = true;
              } else {
                  // Cette requête réussira car auth != null
                  isWhitelisted = await checkConsultantEmailExists(cleanEmail);
              }
              
              if (!isWhitelisted) {
                  throw new Error("CONSULTANT_NOT_AUTHORIZED");
              }
          } else {
              // --- VÉRIFICATION CLIENT ---
              // Cette requête réussira car auth != null
              const isClientWhitelisted = await checkClientEmailExists(cleanEmail);
              
              if (!isClientWhitelisted) {
                  // On vérifie si ce n'est pas un consultant qui se trompe de porte
                  const isActuallyConsultant = await checkConsultantEmailExists(cleanEmail);
                  if (isActuallyConsultant || cleanEmail === EXPERT_EMAIL) {
                      throw new Error("WRONG_PORTAL_CONSULTANT");
                  }
                  throw new Error("CLIENT_NOT_FOUND");
              }
          }
      } catch (validationError: any) {
          // ÉCHEC DE VALIDATION MÉTIER
          // L'utilisateur est connecté mais n'est pas dans notre base de données.
          // SÉCURITÉ : On détruit sa session immédiatement.
          
          if (isSignUp && auth.currentUser) {
              // Si c'était une inscription, on supprime le compte créé "pour rien"
              await deleteUser(auth.currentUser);
          } else {
              // Si c'était une connexion, on déconnecte juste
              await signOut(auth);
          }
          throw validationError; // On renvoie l'erreur pour l'affichage
      }

      // Si on arrive ici, tout est OK : Auth valide + Whitelist validée.
      // Réinitialiser le compteur d'échecs
      resetFailedAttempts();
      // App.tsx prendra le relais via le listener onAuthStateChanged.

    } catch (err: any) {
        console.error(err);
        // Enregistrer la tentative échouée pour le rate limiting
        recordFailedAttempt();
        
        // Affichage des erreurs à l'utilisateur
        if (err.message === 'CONSULTANT_NOT_AUTHORIZED') {
            setError("ACCÈS REFUSÉ : Email non reconnu dans l'équipe Consultant.");
        } else if (err.message === 'CLIENT_NOT_FOUND') {
            setError(isSignUp 
                ? "ACTIVATION IMPOSSIBLE : Votre dossier n'est pas encore créé par le cabinet. Contactez votre consultant." 
                : "ACCÈS REFUSÉ : Aucun dossier client actif associé à cet email.");
        } else if (err.message === 'WRONG_PORTAL_CONSULTANT') {
            setError("IDENTIFICATION CONSULTANT : Veuillez utiliser l'onglet 'Espace Consultant'.");
        } else if (err.message === 'EMAIL_TAKEN') {
            setError("Cet email est déjà activé. Veuillez passer en mode 'Connexion'.");
            setIsSignUp(false);
        } else if (err.message === 'BAD_CREDS') {
            setError("Identifiants incorrects.");
        } else if (err.message === 'WEAK_PASSWORD') {
            setError("Mot de passe trop faible (6 caractères min).");
        } else if (err.message === 'BLOCKED') {
            setError("Compte temporairement bloqué (Trop d'essais).");
        } else if (err.code === 'permission-denied') {
            setError("ERREUR SYSTÈME : Droits d'accès insuffisants.");
        } else {
            setError("Erreur de connexion. Vérifiez vos identifiants.");
        }
        
        setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
      if (!email) {
          setError("Saisissez votre email ci-dessus pour recevoir le lien.");
          return;
      }
      try {
          await sendPasswordResetEmail(auth, email);
          setInfoMessage("Lien envoyé ! Vérifiez vos emails (et spams).");
          setError('');
      } catch (e: any) {
          if (e.code === 'auth/user-not-found') setError("Aucun compte trouvé avec cet email.");
          else setError("Erreur d'envoi.");
      }
  };

  const toggleMode = () => {
      setIsSignUp(!isSignUp);
      setError('');
      setInfoMessage('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px] animate-in fade-in zoom-in-95 duration-500">
        
        {/* Left Side: Visuals */}
        <div className={`md:w-1/2 p-10 flex flex-col justify-between text-white transition-colors duration-500 ${activeTab === 'expert' ? 'bg-brand-900' : 'bg-brand-800'}`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
                   {activeTab === 'expert' ? <ShieldCheck className="w-6 h-6 text-accent-500"/> : <Building className="w-6 h-6 text-white"/>}
                </div>
                <span className="font-bold text-xl tracking-tight text-white">
                    {activeTab === 'expert' ? 'AB CONSULTANTS' : 'AB CONSULTANTS'}
                </span>
            </div>
            <p className="text-brand-200 text-sm font-medium tracking-wide uppercase">
                {activeTab === 'expert' ? 'Suite de pilotage financier' : 'Espace Client Sécurisé'}
            </p>
          </div>

          <div className="space-y-6">
             <h2 className="text-3xl font-bold leading-tight text-white">
                {activeTab === 'expert' 
                    ? "Expertise et Stratégie." 
                    : "Votre performance financière en temps réel."}
             </h2>
             <p className="text-brand-100 leading-relaxed font-light">
                {activeTab === 'expert'
                    ? "Pilotage global du portefeuille, validation des comptes et analyses stratégiques pour vos clients transport & logistique."
                    : "Accédez à vos tableaux de bord, saisissez vos données d'exploitation et consultez les analyses de votre consultant."}
             </p>
          </div>

          <div className="text-xs text-brand-300/60 pt-6 border-t border-white/10 flex justify-between items-center">
             <span>© 2024 AB Consultants <span className="opacity-50 ml-1 font-mono">v{APP_VERSION}</span></span>
             <span className="text-accent-500 font-bold">SÉCURISÉ PAR FIREBASE</span>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="md:w-1/2 p-10 flex flex-col justify-center bg-white relative">
            
            {/* Tabs */}
            <div className="flex p-1 bg-brand-50 rounded-lg mb-8">
                <button 
                    onClick={() => { setActiveTab('client'); setError(''); setIsSignUp(false); setInfoMessage(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'client' ? 'bg-white text-brand-900 shadow-sm ring-1 ring-black/5' : 'text-brand-400 hover:text-brand-600'}`}
                >
                    <UserCircle className="w-4 h-4" /> Espace Client
                </button>
                <button 
                    onClick={() => { setActiveTab('expert'); setError(''); setIsSignUp(false); setInfoMessage(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'expert' ? 'bg-white text-brand-900 shadow-sm ring-1 ring-black/5' : 'text-brand-400 hover:text-brand-600'}`}
                >
                    <ShieldCheck className="w-4 h-4" /> Espace Consultant
                </button>
            </div>

            <div className="mb-6">
                <h3 className="text-2xl font-bold text-brand-900 mb-1">
                    {activeTab === 'expert' ? (isSignUp ? 'Activer mon accès' : 'Connexion Admin') : (isSignUp ? 'Activer mon accès' : 'Connexion')}
                </h3>
                <p className="text-brand-500 text-sm">
                    {activeTab === 'client' 
                        ? (isSignUp ? "Création du mot de passe pour votre dossier existant." : "Connectez-vous pour accéder à vos dossiers.") 
                        : (isSignUp ? "Création de mot de passe pour les collaborateurs." : "Accès réservé aux associés du cabinet.")}
                </p>
            </div>

            <form onSubmit={handleAuthAction} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-brand-700 uppercase mb-1">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 w-4 h-4 text-brand-400" />
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={activeTab === 'client' ? "email@societe.com" : EXPERT_EMAIL}
                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-brand-200 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder-brand-300 text-brand-900"
                        />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-brand-700 uppercase">Mot de passe</label>
                        {!isSignUp && (
                            <button type="button" onClick={handleResetPassword} className="text-[10px] font-bold text-brand-500 hover:text-brand-700 flex items-center gap-1">
                                <KeyRound className="w-3 h-3" /> Oublié ?
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 w-4 h-4 text-brand-400" />
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-brand-200 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder-brand-300 text-brand-900"
                        />
                    </div>
                </div>

                {(error || lockoutMessage) && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-start gap-2 animate-in slide-in-from-top-1">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-tight">{lockoutMessage || error}</span>
                    </div>
                )}

                {infoMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg flex items-center gap-2 animate-in slide-in-from-top-1">
                        <ShieldCheck className="w-4 h-4 shrink-0" /> {infoMessage}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading || isLockedOut()}
                    className={`w-full py-3 px-4 rounded-lg font-bold text-white shadow-lg shadow-brand-900/10 hover:shadow-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'expert' ? 'bg-brand-900 hover:bg-brand-800' : 'bg-brand-600 hover:bg-brand-700'} ${isLockedOut() ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        isSignUp ? <>Créer mon mot de passe <UserPlus className="w-5 h-5" /></> : <>Se connecter <ArrowRight className="w-5 h-5" /></>
                    )}
                </button>
            </form>
            
            {/* TOGGLE MODE LINK */}
            <div className="mt-6 text-center border-t border-brand-50 pt-4">
                <button 
                    onClick={toggleMode}
                    className="text-xs text-brand-500 hover:text-brand-800 font-medium transition-colors"
                >
                    {isSignUp 
                        ? "J'ai déjà un mot de passe. Me connecter." 
                        : (activeTab === 'expert' ? "Invité par l'admin ? Activer mon accès." : "Première connexion ? Créer mon accès.")
                    }
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
