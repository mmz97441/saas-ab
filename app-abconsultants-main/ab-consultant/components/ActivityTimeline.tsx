
import React, { useEffect, useState } from 'react';
import {
    Clock, Mail, MessageSquare, Calendar, CheckCircle, Settings,
    FileText, Send, Power, UserPlus, Loader2, Activity, Eye
} from 'lucide-react';
import { ActivityEvent, ActivityEventType } from '../types';
import { getClientActivities } from '../services/dataService';

interface ActivityTimelineProps {
    clientId: string;
    clientName: string;
}

const EVENT_CONFIG: Record<ActivityEventType, { icon: React.ReactNode; color: string; bgColor: string }> = {
    client_created: { icon: <UserPlus className="w-3.5 h-3.5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
    data_submitted: { icon: <FileText className="w-3.5 h-3.5" />, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    data_validated: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
    data_published: { icon: <Eye className="w-3.5 h-3.5" />, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    appointment_scheduled: { icon: <Calendar className="w-3.5 h-3.5" />, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
    appointment_confirmed: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
    email_sent: { icon: <Mail className="w-3.5 h-3.5" />, color: 'text-amber-600', bgColor: 'bg-amber-100' },
    message_received: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-sky-600', bgColor: 'bg-sky-100' },
    config_updated: { icon: <Settings className="w-3.5 h-3.5" />, color: 'text-slate-600', bgColor: 'bg-slate-100' },
    status_changed: { icon: <Power className="w-3.5 h-3.5" />, color: 'text-amber-600', bgColor: 'bg-amber-100' },
    invitation_sent: { icon: <Send className="w-3.5 h-3.5" />, color: 'text-brand-600', bgColor: 'bg-brand-100' }
};

const formatTimestamp = (ts: any): string => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD < 7) return `Il y a ${diffD}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: diffD > 365 ? 'numeric' : undefined });
};

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ clientId, clientName }) => {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const data = await getClientActivities(clientId, 20);
            setEvents(data);
            setIsLoading(false);
        };
        load();
    }, [clientId]);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-bold text-slate-700">Activité Récente</h3>
                <span className="text-[10px] text-slate-400 font-medium">{clientName}</span>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-xs">Chargement...</span>
                </div>
            ) : events.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Aucune activité enregistrée.</p>
                    <p className="text-[10px] mt-1">Les prochaines actions seront tracées ici.</p>
                </div>
            ) : (
                <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />

                    <div className="space-y-1">
                        {events.map((event, i) => {
                            const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.config_updated;
                            return (
                                <div key={event.id} className="relative flex items-start gap-3 py-2 pl-0 group">
                                    {/* Dot */}
                                    <div className={`relative z-10 w-[31px] h-[31px] rounded-full flex items-center justify-center shrink-0 ${config.bgColor} ${config.color} border-2 border-white shadow-sm`}>
                                        {config.icon}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pt-0.5">
                                        <p className="text-xs text-slate-700 leading-relaxed">{event.description}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{formatTimestamp(event.timestamp)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityTimeline;
