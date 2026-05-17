
import React, { useState } from 'react';
import { ShieldCheck, UserCircle, ArrowRight, Loader2, AlertCircle, Building, Mail, Lock, UserPlus, KeyRound } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { refreshUserRole } from '../lib/cloudFunctions';
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

  // Email de l'expert (Super Admin) - doit correspondre à AuthContext.tsx
  const EXPERT_EMAIL = "nice.guillaume@gmail.com";

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
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
      // MAINTENANT, on vérifie s'il a le droit d'entrer via la Cloud Function setUserRole
      // qui utilise l'Admin SDK (bypass les règles Firestore) et set les custom claims.

      try {
          const roleResult = await refreshUserRole();

          if (activeTab === 'expert') {
              if (roleResult.role !== 'consultant') {
                  throw new Error("CONSULTANT_NOT_AUTHORIZED");
              }
          } else {
              if (roleResult.role === 'consultant') {
                  throw new Error("WRONG_PORTAL_CONSULTANT");
              }
              if (roleResult.role !== 'client') {
                  throw new Error("CLIENT_NOT_FOUND");
              }
          }

          // Force le refresh du token pour que AuthContext récupère les claims
          await auth.currentUser?.getIdToken(true);
      } catch (validationError: any) {
          // ÉCHEC DE VALIDATION MÉTIER
          // L'utilisateur est connecté mais n'est pas dans notre base de données.
          // SÉCURITÉ : On détruit sa session immédiatement.

          if (isSignUp && auth.currentUser) {
              await deleteUser(auth.currentUser);
          } else {
              await signOut(auth);
          }

          // Traduire l'erreur Cloud Function en erreur métier
          if (validationError?.code === 'functions/permission-denied') {
              if (activeTab === 'expert') throw new Error("CONSULTANT_NOT_AUTHORIZED");
              throw new Error("CLIENT_NOT_FOUND");
          }
          throw validationError;
      }

      // Si on arrive ici, tout est OK : Auth valide + Whitelist validée.
      // App.tsx prendra le relais via le listener onAuthStateChanged.

    } catch (err: any) {
        console.error(err);
        
        // Affichage des erreurs à l'utilisateur
        if (err.message === 'CONSULTANT_NOT_AUTHORIZED') {
            setError("ACCÈS REFUSÉ : Email non reconnu dans l'équipe Consultant.");
        } else if (err.message === 'CLIENT_NOT_FOUND') {
            setError(isSignUp
                ? "ACTIVATION IMPOSSIBLE : Votre dossier n'est pas encore créé par le cabinet.\n\nContactez AB Consultants : contact@ab-consultants.fr"
                : "ACCÈS REFUSÉ : Aucun dossier client actif associé à cet email.\n\nSi vous pensez que c'est une erreur, contactez votre consultant ou écrivez à contact@ab-consultants.fr");
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
    <div className="min-h-screen flex items-center justify-center bg-paper-50 p-4">
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
            <p className="eyebrow text-brand-200">
                {activeTab === 'expert' ? 'Suite de pilotage financier' : 'Espace Client Sécurisé'}
            </p>
          </div>

          <div className="space-y-6">
             <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-white [text-wrap:balance]">
                {activeTab === 'expert'
                    ? "Expertise et Stratégie."
                    : "Votre performance financière en temps réel."}
             </h2>
             <p className="text-brand-100 leading-relaxed font-light">
                {activeTab === 'expert'
                    ? "Pilotage global du portefeuille, validation des comptes et analyses stratégiques pour vos clients transport & logistique."
                    : "Accédez à vos tableaux de bord, saisissez vos données d'exploitation et consultez les analyses de votre consultant."}
             </p>

             <ul className="space-y-2.5 pt-2">
                {(activeTab === 'expert'
                    ? ["Pilotage temps réel du portefeuille", "Validation experte des saisies clients", "Analyses stratégiques mensuelles"]
                    : ["Saisie guidée mois par mois", "Tableaux de bord temps réel", "Échanges directs avec votre consultant"]
                ).map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-brand-100/85 font-light">
                        <span className="w-1 h-1 rounded-full bg-accent-400 shrink-0" aria-hidden="true" />
                        {item}
                    </li>
                ))}
             </ul>
          </div>

          <div className="text-xs text-brand-200 pt-6 border-t border-white/10 flex justify-between items-center">
             <span>© {new Date().getFullYear()} AB Consultants</span>
             <span className="text-accent-400 font-semibold tracking-[0.12em] uppercase text-[10px]">
                Connexion sécurisée
             </span>
             {import.meta.env.DEV && (
                <span className="font-mono text-brand-300 absolute bottom-2 right-2 opacity-50" aria-hidden="true">v{APP_VERSION}</span>
             )}
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="md:w-1/2 p-10 flex flex-col justify-center bg-white relative">
            
            {/* Tabs */}
            <div className="flex p-1 bg-brand-50 rounded-lg mb-8" role="tablist" aria-label="Type de compte">
                <button
                    role="tab"
                    aria-selected={activeTab === 'client'}
                    onClick={() => { setActiveTab('client'); setError(''); setIsSignUp(false); setInfoMessage(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all ${activeTab === 'client' ? 'bg-white text-brand-900 shadow-sm ring-1 ring-black/5' : 'text-brand-400 hover:text-brand-600'}`}
                >
                    <UserCircle className="w-4 h-4" /> Espace Client
                </button>
                <button
                    role="tab"
                    aria-selected={activeTab === 'expert'}
                    onClick={() => { setActiveTab('expert'); setError(''); setIsSignUp(false); setInfoMessage(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all ${activeTab === 'expert' ? 'bg-white text-brand-900 shadow-sm ring-1 ring-black/5' : 'text-brand-400 hover:text-brand-600'}`}
                >
                    <ShieldCheck className="w-4 h-4" /> Espace Consultant
                </button>
            </div>

            <div className="mb-6">
                <h3 className="font-display text-2xl font-semibold text-brand-900 tracking-tight mb-1">
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
                    <label className="eyebrow text-brand-700 block mb-1">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 w-4 h-4 text-brand-400" />
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={activeTab === 'client' ? "email@societe.com" : "consultant@ab-consultants.fr"}
                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-brand-200 bg-white focus:border-brand-400 focus:bg-paper-50/40 transition-colors placeholder-brand-300 text-brand-900"
                        />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="eyebrow text-brand-700 block">Mot de passe</label>
                        {!isSignUp && (
                            <button type="button" onClick={handleResetPassword} className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 py-1 px-2 -my-1 -mr-2 rounded hover:bg-brand-50 transition">
                                <KeyRound className="w-3 h-3" /> Mot de passe oublié ?
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
                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-brand-200 bg-white focus:border-brand-400 focus:bg-paper-50/40 transition-colors placeholder-brand-300 text-brand-900"
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-start gap-2 animate-in slide-in-from-top-1">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-tight whitespace-pre-line">{error}</span>
                    </div>
                )}

                {infoMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg flex items-center gap-2 animate-in slide-in-from-top-1">
                        <ShieldCheck className="w-4 h-4 shrink-0" /> {infoMessage}
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className={`w-full py-3 px-4 rounded-lg font-bold text-white shadow-lg shadow-brand-900/10 hover:shadow-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'expert' ? 'bg-brand-900 hover:bg-brand-800' : 'bg-brand-600 hover:bg-brand-700'}`}
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        isSignUp ? <>Créer mon mot de passe <UserPlus className="w-5 h-5" /></> : <>Se connecter <ArrowRight className="w-5 h-5" /></>
                    )}
                </button>
            </form>
            
            {/* TOGGLE MODE LINK */}
            <div className="mt-7" aria-hidden={false}>
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-brand-300 font-semibold">
                    <span className="flex-1 h-px bg-brand-100" />
                    <span>ou</span>
                    <span className="flex-1 h-px bg-brand-100" />
                </div>
                <div className="mt-3 text-center">
                    <button
                        onClick={toggleMode}
                        className="text-sm text-brand-700 hover:text-brand-900 font-semibold transition-colors py-1.5 px-3 rounded-md hover:bg-brand-50 underline-offset-4 decoration-accent-400 decoration-2 hover:underline"
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
    </div>
  );
};

export default LoginScreen;
