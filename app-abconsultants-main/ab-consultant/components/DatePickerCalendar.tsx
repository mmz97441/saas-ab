import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin } from 'lucide-react';

interface AppointmentInfo {
  date: string;       // YYYY-MM-DD
  time: string;
  clientName: string;
  location?: string;
  status: string;
}

interface DatePickerCalendarProps {
  value: string;              // YYYY-MM-DD
  onChange: (date: string) => void;
  minDate?: string;           // YYYY-MM-DD
  appointments?: AppointmentInfo[];
}

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const DatePickerCalendar: React.FC<DatePickerCalendarProps> = ({ value, onChange, minDate, appointments = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value) return new Date(value + 'T00:00:00');
    return new Date();
  });
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fermer quand on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Premier jour du mois (0=dimanche, on veut lundi=0)
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7; // Lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Jours du mois précédent pour remplir la première semaine
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Construire la grille
  const cells: { day: number; month: number; year: number; isCurrentMonth: boolean; dateStr: string }[] = [];

  // Jours précédents
  for (let i = startDow - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ day: d, month: m, year: y, isCurrentMonth: false, dateStr: formatISO(y, m, d) });
  }

  // Jours du mois courant
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, isCurrentMonth: true, dateStr: formatISO(year, month, d) });
  }

  // Jours suivants pour compléter la dernière semaine
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      cells.push({ day: d, month: m, year: y, isCurrentMonth: false, dateStr: formatISO(y, m, d) });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatISO(today.getFullYear(), today.getMonth(), today.getDate());

  // Map des rdv par date
  const appointmentsByDate = new Map<string, AppointmentInfo[]>();
  appointments.forEach(a => {
    if (!appointmentsByDate.has(a.date)) appointmentsByDate.set(a.date, []);
    appointmentsByDate.get(a.date)!.push(a);
  });

  const isDisabled = (dateStr: string) => {
    if (!minDate) return false;
    return dateStr < minDate;
  };

  const handleSelect = (dateStr: string) => {
    if (isDisabled(dateStr)) return;
    onChange(dateStr);
    setIsOpen(false);
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // Date affichée dans le bouton
  const displayDate = value ? formatDisplayDate(value) : null;

  // RDV du jour survolé ou sélectionné (pour l'encart)
  const activeDate = hoveredDate || value;
  const activeAppointments = activeDate ? (appointmentsByDate.get(activeDate) || []) : [];

  return (
    <div ref={containerRef} className="relative">
      {/* Bouton déclencheur */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && value) setViewDate(new Date(value + 'T00:00:00'));
        }}
        className={`w-full px-3 py-2 rounded-lg border text-sm text-left flex items-center gap-2 transition ${
          isOpen
            ? 'border-brand-500 ring-2 ring-brand-500 bg-white'
            : 'border-slate-300 bg-white hover:border-brand-400'
        }`}
      >
        <Calendar className="w-4 h-4 text-brand-500 shrink-0" />
        {displayDate ? (
          <span className="text-slate-800 font-medium">{displayDate}</span>
        ) : (
          <span className="text-slate-400">Choisir une date...</span>
        )}
      </button>

      {/* Calendrier déroulant */}
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-[340px] left-0">
          {/* En-tête navigation */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-sm font-bold text-slate-800">
              {MOIS[month]} {year}
            </span>
            <button type="button" onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Jours de la semaine */}
          <div className="grid grid-cols-7 mb-1">
            {JOURS.map(j => (
              <div key={j} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">
                {j}
              </div>
            ))}
          </div>

          {/* Grille des jours */}
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              const disabled = isDisabled(cell.dateStr);
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === value;
              const hasAppointments = appointmentsByDate.has(cell.dateStr);
              const dayAppts = appointmentsByDate.get(cell.dateStr) || [];
              const hasConfirmed = dayAppts.some(a => a.status === 'confirmed');
              const hasPending = dayAppts.some(a => a.status !== 'confirmed');

              return (
                <button
                  type="button"
                  key={idx}
                  disabled={disabled}
                  onClick={() => handleSelect(cell.dateStr)}
                  onMouseEnter={() => setHoveredDate(cell.dateStr)}
                  onMouseLeave={() => setHoveredDate(null)}
                  className={`relative h-9 w-full flex flex-col items-center justify-center rounded-lg text-xs transition
                    ${disabled ? 'text-slate-200 cursor-not-allowed' : 'cursor-pointer'}
                    ${!cell.isCurrentMonth && !disabled ? 'text-slate-300' : ''}
                    ${cell.isCurrentMonth && !disabled && !isSelected && !isToday ? 'text-slate-700 hover:bg-brand-50 hover:text-brand-700' : ''}
                    ${isToday && !isSelected ? 'bg-slate-100 text-slate-900 font-bold ring-1 ring-slate-300' : ''}
                    ${isSelected ? 'bg-brand-600 text-white font-bold shadow-sm' : ''}
                  `}
                >
                  <span>{cell.day}</span>
                  {/* Indicateurs de RDV */}
                  {hasAppointments && !disabled && (
                    <div className="flex gap-0.5 absolute bottom-0.5">
                      {hasConfirmed && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      {hasPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Légende */}
          {appointments.length > 0 && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Confirmé
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                En attente
              </div>
            </div>
          )}

          {/* RDV du jour survolé / sélectionné */}
          {activeAppointments.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                RDV du {formatDisplayDate(activeDate!)}
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {activeAppointments.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                      a.status === 'confirmed'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    <Clock className="w-3 h-3 shrink-0 opacity-60" />
                    <span className="font-bold">{a.time}</span>
                    <span className="truncate">{a.clientName}</span>
                    {a.location && (
                      <>
                        <MapPin className="w-3 h-3 shrink-0 opacity-60 ml-auto" />
                        <span className="text-[10px] truncate">{a.location}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function formatISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDisplayDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long' };
  return d.toLocaleDateString('fr-FR', options);
}

export default DatePickerCalendar;
