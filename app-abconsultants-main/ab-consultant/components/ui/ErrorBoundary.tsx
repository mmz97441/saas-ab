import React from 'react';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const isChunkLoadError = (error: Error | null): boolean => {
  if (!error) return false;
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Loading chunk')
  );
};

/**
 * ErrorBoundary global.
 *
 * Attrape les exceptions React et affiche un écran d'erreur propre
 * au lieu d'un écran blanc. Les chunk-load errors (déploiement stale)
 * affichent un message dédié et un hard reload.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const chunkError = isChunkLoadError(this.state.error);

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-lg w-full text-center">
            <div className={`w-16 h-16 ${chunkError ? 'bg-brand-100' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
              {chunkError ? (
                <Sparkles className="w-8 h-8 text-brand-600" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-red-600" />
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              {chunkError ? 'Nouvelle version disponible' : 'Une erreur est survenue'}
            </h2>
            <p className="text-slate-500 text-sm mb-6">
              {chunkError
                ? "L'application a été mise à jour. Rechargez la page pour récupérer la dernière version."
                : "L'application a rencontré un problème inattendu. Cliquez ci-dessous pour réessayer."}
            </p>
            {this.state.error && !chunkError && (
              <details className="text-left mb-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
                <summary className="text-xs font-bold text-slate-500 uppercase cursor-pointer">
                  Détails techniques
                </summary>
                <pre className="text-xs text-red-600 mt-2 whitespace-pre-wrap overflow-auto max-h-40">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition shadow-md flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" /> {chunkError ? 'Recharger' : 'Réessayer'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
