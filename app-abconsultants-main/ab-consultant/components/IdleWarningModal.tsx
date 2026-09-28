import React from 'react';
import { Clock, LogOut } from 'lucide-react';

interface IdleWarningModalProps {
  isOpen: boolean;
  remainingMs: number;
  onStayConnected: () => void;
  onLogoutNow: () => void;
}

const formatMMSS = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
};

const IdleWarningModal: React.FC<IdleWarningModalProps> = ({ isOpen, remainingMs, onStayConnected, onLogoutNow }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-paper-900/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
    >
      <div className="max-w-md w-full bg-white rounded-2xl shadow-paper-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-paper-900 px-6 py-4 flex items-center gap-3 text-white">
          <div className="w-9 h-9 rounded-lg bg-accent-500/15 flex items-center justify-center">
            <Clock className="w-5 h-5 text-accent-400" />
          </div>
          <div>
            <p className="eyebrow text-accent-400 text-[10px] tracking-[0.18em]">Session</p>
            <h2 id="idle-warning-title" className="font-display text-lg font-semibold leading-tight">
              Inactivité détectée
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-brand-700 text-sm leading-relaxed">
            Pour des raisons de sécurité, vous serez déconnecté automatiquement dans :
          </p>

          <div className="bg-paper-50 border border-paper-200 rounded-xl py-5 text-center">
            <div className="font-mono text-4xl font-semibold text-brand-900 tabular-nums">
              {formatMMSS(remainingMs)}
            </div>
            <div className="eyebrow text-brand-400 text-[10px] mt-1">Minutes : Secondes</div>
          </div>

          <p className="text-xs text-brand-500 leading-relaxed">
            Vos données saisies sont auto-sauvegardées. Cliquez sur <strong className="text-brand-700">"Rester connecté"</strong> pour prolonger votre session d'une heure.
          </p>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onLogoutNow}
              className="flex-1 py-2.5 px-4 rounded-lg border border-paper-200 text-brand-600 font-semibold text-sm hover:bg-paper-50 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Me déconnecter
            </button>
            <button
              type="button"
              onClick={onStayConnected}
              autoFocus
              className="flex-1 py-2.5 px-4 rounded-lg bg-brand-900 text-white font-semibold text-sm hover:bg-brand-800 transition-colors shadow-paper"
            >
              Rester connecté
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdleWarningModal;
