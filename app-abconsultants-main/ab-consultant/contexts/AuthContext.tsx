import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { refreshUserRole } from '../lib/cloudFunctions';

// =============================================
// TYPES
// =============================================
export type UserRole = 'ab_consultant' | 'client';

export interface AuthClaims {
  role: UserRole | null;
  clientId?: string;
  isAdmin: boolean;
}

export interface AuthState {
  user: User | null;
  claims: AuthClaims;
  loading: boolean;
  currentUserEmail: string | null;
  isSuperAdmin: boolean;
}

interface AuthContextValue extends AuthState {
  logout: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const SUPER_ADMIN_EMAIL = 'nice.guillaume@gmail.com';

// =============================================
// CONTEXT
// =============================================
const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    claims: { role: null, isAdmin: false },
    loading: true,
    currentUserEmail: null,
    isSuperAdmin: false,
  });

  const resolveRole = useCallback(async (user: User): Promise<AuthState> => {
    const email = user.email?.toLowerCase().trim() || '';

    // Tenter de lire les Custom Claims du token (backend)
    // Si les claims ne sont pas encore set (période de transition), fallback sur la logique client
    try {
      const idTokenResult = await user.getIdTokenResult(true);
      const tokenRole = idTokenResult.claims.role as string | undefined;
      const tokenClientId = idTokenResult.claims.clientId as string | undefined;
      const tokenIsAdmin = idTokenResult.claims.isAdmin as boolean | undefined;

      if (tokenRole === 'consultant') {
        return {
          user,
          claims: { role: 'ab_consultant', isAdmin: tokenIsAdmin || email === SUPER_ADMIN_EMAIL },
          loading: false,
          currentUserEmail: email,
          isSuperAdmin: tokenIsAdmin || email === SUPER_ADMIN_EMAIL,
        };
      }

      if (tokenRole === 'client' && tokenClientId) {
        return {
          user,
          claims: { role: 'client', clientId: tokenClientId, isAdmin: false },
          loading: false,
          currentUserEmail: email,
          isSuperAdmin: false,
        };
      }
    } catch (e) {
      // Token refresh failed, try fallback
    }

    // FALLBACK : appeler setUserRole (Cloud Function Admin SDK) pour rafraîchir les claims
    // puis relire le token. Évite les requêtes Firestore directes qui échouent
    // quand les custom claims ne sont pas encore en place.
    try {
      const roleResult = await refreshUserRole();
      const refreshedToken = await user.getIdTokenResult(true);
      const refreshedRole = refreshedToken.claims.role as string | undefined;
      const refreshedClientId = refreshedToken.claims.clientId as string | undefined;
      const refreshedIsAdmin = refreshedToken.claims.isAdmin as boolean | undefined;

      if (refreshedRole === 'consultant') {
        return {
          user,
          claims: { role: 'ab_consultant', isAdmin: refreshedIsAdmin || email === SUPER_ADMIN_EMAIL },
          loading: false,
          currentUserEmail: email,
          isSuperAdmin: refreshedIsAdmin || email === SUPER_ADMIN_EMAIL,
        };
      }

      if (refreshedRole === 'client' && (refreshedClientId || roleResult.clientId)) {
        return {
          user,
          claims: { role: 'client', clientId: refreshedClientId || roleResult.clientId, isAdmin: false },
          loading: false,
          currentUserEmail: email,
          isSuperAdmin: false,
        };
      }
    } catch (e) {
      // Cloud Function rejected: user not authorized
    }

    // Non autorisé
    await signOut(auth);
    return {
      user: null,
      claims: { role: null, isAdmin: false },
      loading: false,
      currentUserEmail: null,
      isSuperAdmin: false,
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({
          user: null,
          claims: { role: null, isAdmin: false },
          loading: false,
          currentUserEmail: null,
          isSuperAdmin: false,
        });
        return;
      }

      setState(prev => ({ ...prev, loading: true }));
      const resolved = await resolveRole(user);
      setState(resolved);
    });

    return () => unsubscribe();
  }, [resolveRole]);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const refreshClaims = useCallback(async () => {
    if (state.user) {
      setState(prev => ({ ...prev, loading: true }));
      const resolved = await resolveRole(state.user);
      setState(resolved);
    }
  }, [state.user, resolveRole]);

  return (
    <AuthContext.Provider value={{ ...state, logout, refreshClaims }}>
      {children}
    </AuthContext.Provider>
  );
};

// =============================================
// HOOK
// =============================================
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
