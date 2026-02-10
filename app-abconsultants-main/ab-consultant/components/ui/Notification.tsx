import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

const STYLES = {
  success: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    icon: CheckCircle,
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    icon: Info,
  },
};

const Notification: React.FC<NotificationProps> = ({ message, type, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const style = STYLES[type];
  const Icon = style.icon;

  return (
    <div className={`fixed top-4 right-4 z-50 px-5 py-4 rounded-xl shadow-xl border animate-in slide-in-from-right-10 duration-300 max-w-md ${style.bg}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${style.text} shrink-0`} />
        <p className={`font-medium text-sm flex-1 ${style.text}`}>{message}</p>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/50 transition">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
};

export default Notification;
