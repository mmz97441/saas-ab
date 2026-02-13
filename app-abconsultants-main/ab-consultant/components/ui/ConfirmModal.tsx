import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Modale de confirmation réutilisable.
 * Remplace TOUS les window.confirm() et window.alert() de l'app.
 */
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger' | 'success' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  showCancel?: boolean;
}

const VARIANT_STYLES = {
  default: {
    icon: 'bg-brand-100 text-brand-600',
    button: 'bg-brand-600 hover:bg-brand-700',
  },
  danger: {
    icon: 'bg-red-100 text-red-600',
    button: 'bg-red-600 hover:bg-red-700',
  },
  success: {
    icon: 'bg-emerald-100 text-emerald-600',
    button: 'bg-emerald-600 hover:bg-emerald-700',
  },
  info: {
    icon: 'bg-blue-100 text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700',
  },
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  onConfirm,
  onCancel,
  showCancel = true,
}) => {
  if (!isOpen) return null;

  const styles = VARIANT_STYLES[variant];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-4 flex items-start gap-4">
          <div className={`p-3 rounded-xl ${styles.icon} shrink-0`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-modal-title" className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{message}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Fermer"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3 justify-end">
          {showCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg text-slate-700 font-bold hover:bg-slate-100 border border-slate-200 transition"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-6 py-2.5 rounded-lg text-white font-bold shadow-md hover:shadow-lg transition ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
