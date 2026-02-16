import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Check, AlertTriangle, Loader2, CalendarPlus, RefreshCw } from 'lucide-react';
import { Client, NextAppointment } from '../types';
import { scheduleAppointment } from '../lib/cloudFunctions';
import { saveClient } from '../services/dataService';
import DatePickerCalendar from './DatePickerCalendar';

interface AppointmentPanelProps {
  client: Client;
  onAppointmentScheduled: () => void;
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  allClients?: Client[];
}

const AppointmentPanel: React.FC<AppointmentPanelProps> = ({ client, onAppointmentScheduled, showNotification, allClients = [] }) => {
  const [isScheduling, setIsScheduling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    time: '09:00',
    location: client.city || '',
  });

  const appointment = client.nextAppointment;

  // Construire la liste de tous les RDV pour le calendrier
  const allAppointments = allClients
    .filter(c => c.nextAppointment?.date)
    .map(c => ({
      date: c.nextAppointment!.date,
      time: c.nextAppointment!.time,
      clientName: c.owner?.name || c.managerName || c.companyName || 'Client',
      location: c.nextAppointment!.location,
      status: c.nextAppointment!.status,
    }));

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.time) return;

    setIsLoading(true);
    try {
      const result = await scheduleAppointment({
        clientId: client.id,
        date: formData.date,
        time: formData.time,
        location: formData.location,
      });
      if (result.emailSent === false) {
        showNotification('RDV programmé, mais l\'email n\'a pas pu être envoyé. Vérifiez l\'adresse email du client.', 'info');
      } else {
        showNotification('RDV programmé. Email de convocation envoyé.', 'success');
      }
      setIsScheduling(false);
      onAppointmentScheduled();
    } catch (err: any) {
      console.error('Schedule error:', err);
      showNotification(err?.message || 'Erreur lors de la programmation du RDV.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptProposal = async () => {
    if (!appointment?.proposedDate || !appointment?.proposedTime) return;
    setIsLoading(true);
    try {
      const updatedClient = {
        ...client,
        nextAppointment: {
          ...appointment,
          date: appointment.proposedDate,
          time: appointment.proposedTime,
          status: 'confirmed' as const,
          proposedDate: undefined,
          proposedTime: undefined,
          remindersSent: [],
        },
      };
      await saveClient(updatedClient);
      showNotification('Nouvelle date acceptée.', 'success');
      onAppointmentScheduled();
    } catch (err: any) {
      showNotification(err?.message || 'Erreur.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (isoDate: string): string => {
    const dateObj = new Date(isoDate + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return dateObj.toLocaleDateString('fr-FR', options);
  };

  // Calcul des jours restants
  const getDaysUntil = (dateStr: string): number => {
    const rdv = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((rdv.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Minimum date pour le formulaire = demain
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  // Formulaire réutilisable avec le DatePickerCalendar
  const renderForm = (submitLabel: string, onCancel: () => void) => (
    <form onSubmit={handleSchedule} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
          <DatePickerCalendar
            value={formData.date}
            onChange={(date) => setFormData({ ...formData, date })}
            minDate={minDate}
            appointments={allAppointments}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Heure</label>
          <input type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} required className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lieu</label>
          <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="Sainte-Clotilde" className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition disabled:opacity-50 flex items-center gap-1">
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-500 text-xs hover:text-slate-700">Annuler</button>
      </div>
    </form>
  );

  // --- ÉTAT : Proposition de changement du client ---
  if (appointment?.status === 'pending_change' && appointment.proposedDate) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-bold text-amber-900 text-sm">Demande de changement de RDV</h3>
            <p className="text-amber-700 text-xs mt-1">
              <strong>{client.owner?.name || client.managerName}</strong> souhaite modifier le RDV.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Date actuelle</p>
                <p className="text-sm font-bold text-slate-800">{formatDate(appointment.date)}</p>
                <p className="text-xs text-slate-500">{appointment.time} — {appointment.location || 'Lieu non précisé'}</p>
              </div>
              <div className="bg-white/60 rounded-lg p-3 border-2 border-amber-300">
                <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Date proposée</p>
                <p className="text-sm font-bold text-slate-800">{formatDate(appointment.proposedDate)}</p>
                <p className="text-xs text-slate-500">{appointment.proposedTime}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAcceptProposal}
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Accepter cette date
              </button>
              <button
                onClick={() => setIsScheduling(true)}
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-white border border-amber-300 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-50 transition disabled:opacity-50"
              >
                Proposer une autre date
              </button>
            </div>
          </div>
        </div>

        {/* Formulaire de contre-proposition */}
        {isScheduling && (
          <div className="mt-4 pt-4 border-t border-amber-200">
            {renderForm('Reprogrammer', () => setIsScheduling(false))}
          </div>
        )}
      </div>
    );
  }

  // --- ÉTAT : RDV existant (proposed ou confirmed) ---
  if (appointment?.date) {
    const daysUntil = getDaysUntil(appointment.date);
    const isPast = daysUntil < 0;
    const isConfirmed = appointment.status === 'confirmed';

    // Si le RDV est passé, on propose d'en programmer un nouveau
    if (isPast) {
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Dernier RDV</p>
              <p className="text-sm text-slate-600 mt-1">{formatDate(appointment.date)} à {appointment.time}</p>
            </div>
            <button
              onClick={() => setIsScheduling(true)}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition flex items-center gap-1.5"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Programmer le prochain RDV
            </button>
          </div>

          {isScheduling && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              {renderForm('Programmer', () => setIsScheduling(false))}
            </div>
          )}
        </div>
      );
    }

    // RDV à venir
    return (
      <div className={`rounded-xl p-5 border ${isConfirmed ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                isConfirmed ? 'bg-emerald-200 text-emerald-800' : 'bg-blue-200 text-blue-800'
              }`}>
                {isConfirmed ? <><Check className="w-3 h-3" /> Confirmé</> : <><Clock className="w-3 h-3" /> En attente de confirmation</>}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                J-{daysUntil}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-800">{formatDate(appointment.date)}</p>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{appointment.time}</span>
              {appointment.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{appointment.location}</span>}
            </div>
          </div>

          <button
            onClick={() => setIsScheduling(!isScheduling)}
            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg transition"
            title="Reprogrammer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Formulaire de reprogrammation */}
        {isScheduling && (
          <div className={`mt-4 pt-4 border-t ${isConfirmed ? 'border-emerald-200' : 'border-blue-200'}`}>
            <p className="text-xs text-slate-500 font-medium mb-3">Reprogrammer le RDV (un nouvel email sera envoyé) :</p>
            {renderForm('Reprogrammer', () => setIsScheduling(false))}
          </div>
        )}
      </div>
    );
  }

  // --- ÉTAT : Aucun RDV programmé ---
  if (!isScheduling) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-5 text-center">
        <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500 mb-3">Aucun rendez-vous programmé</p>
        <button
          onClick={() => setIsScheduling(true)}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition inline-flex items-center gap-1.5"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          Programmer un RDV
        </button>
      </div>
    );
  }

  // --- ÉTAT : Formulaire de programmation ---
  return (
    <div className="bg-white border border-brand-200 rounded-xl p-5">
      <h3 className="text-sm font-bold text-brand-900 mb-3 flex items-center gap-2">
        <CalendarPlus className="w-4 h-4 text-brand-600" />
        Programmer un rendez-vous
      </h3>
      {renderForm('Programmer et envoyer la convocation', () => setIsScheduling(false))}
    </div>
  );
};

export default AppointmentPanel;
