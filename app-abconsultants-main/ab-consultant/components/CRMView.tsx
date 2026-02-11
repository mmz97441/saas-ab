import React, { useState, useEffect } from 'react';
import { FileText, Plus, Calendar, Phone, Mail, CheckSquare, Square, Trash2, Edit2, Clock, User, Filter, MessageSquare, X } from 'lucide-react';
import { Client, CRMNote } from '../types';
import { getCRMNotes, addCRMNote, updateCRMNote, deleteCRMNote } from '../services/dataService';
import { useConfirmDialog } from '../contexts/ConfirmContext';

interface CRMViewProps {
  client: Client;
  currentUserEmail: string;
  currentUserName: string;
}

const NOTE_TYPES = [
  { value: 'note', label: 'Note', icon: FileText, color: 'bg-blue-100 text-blue-700' },
  { value: 'rdv', label: 'RDV', icon: Calendar, color: 'bg-purple-100 text-purple-700' },
  { value: 'call', label: 'Appel', icon: Phone, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'email', label: 'Email', icon: Mail, color: 'bg-amber-100 text-amber-700' },
  { value: 'task', label: 'Tâche', icon: CheckSquare, color: 'bg-red-100 text-red-700' },
] as const;

const CRMView: React.FC<CRMViewProps> = ({ client, currentUserEmail, currentUserName }) => {
  const [notes, setNotes] = useState<CRMNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<CRMNote | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const confirm = useConfirmDialog();

  // Form state
  const [formType, setFormType] = useState<CRMNote['type']>('note');
  const [formText, setFormText] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

  const loadNotes = async () => {
    setIsLoading(true);
    const data = await getCRMNotes(client.id);
    setNotes(data);
    setIsLoading(false);
  };

  useEffect(() => { loadNotes(); }, [client.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim()) return;

    if (editingNote) {
      await updateCRMNote(editingNote.id, { text: formText, type: formType, dueDate: formDueDate || undefined });
    } else {
      await addCRMNote({
        clientId: client.id,
        authorEmail: currentUserEmail,
        authorName: currentUserName,
        text: formText,
        type: formType,
        dueDate: formDueDate || undefined,
      });
    }
    resetForm();
    await loadNotes();
  };

  const resetForm = () => {
    setFormText('');
    setFormType('note');
    setFormDueDate('');
    setShowForm(false);
    setEditingNote(null);
  };

  const handleEdit = (note: CRMNote) => {
    setEditingNote(note);
    setFormText(note.text);
    setFormType(note.type);
    setFormDueDate(note.dueDate || '');
    setShowForm(true);
  };

  const handleDelete = async (note: CRMNote) => {
    const ok = await confirm({ title: 'Supprimer cette note ?', message: 'Cette action est irréversible.', variant: 'danger', confirmLabel: 'Supprimer' });
    if (!ok) return;
    await deleteCRMNote(note.id);
    await loadNotes();
  };

  const handleToggleDone = async (note: CRMNote) => {
    await updateCRMNote(note.id, { isDone: !note.isDone });
    await loadNotes();
  };

  const filteredNotes = filterType === 'all' ? notes : notes.filter(n => n.type === filterType);

  const pendingTasks = notes.filter(n => n.type === 'task' && !n.isDone).length;
  const upcomingRdv = notes.filter(n => n.type === 'rdv' && n.dueDate && new Date(n.dueDate) >= new Date()).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-500" />
            CRM - {client.companyName}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Suivi de la relation client : notes, rendez-vous, tâches
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 font-bold text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Nouvelle entrée
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Total Notes</p>
          <p className="text-2xl font-bold text-slate-800">{notes.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Tâches en cours</p>
          <p className="text-2xl font-bold text-red-600">{pendingTasks}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase">RDV à venir</p>
          <p className="text-2xl font-bold text-purple-600">{upcomingRdv}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Dirigeant</p>
          <p className="text-sm font-bold text-slate-800 truncate">{client.managerName || '-'}</p>
          <p className="text-[10px] text-slate-400 truncate">{client.owner?.email}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${filterType === 'all' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          Tout ({notes.length})
        </button>
        {NOTE_TYPES.map(nt => {
          const count = notes.filter(n => n.type === nt.value).length;
          return (
            <button
              key={nt.value}
              onClick={() => setFilterType(nt.value)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1 ${filterType === nt.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              <nt.icon className="w-3 h-3" /> {nt.label} ({count})
            </button>
          );
        })}
      </div>

      {/* New/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-brand-200 shadow-lg p-5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-700">{editingNote ? 'Modifier' : 'Nouvelle entrée'}</h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {NOTE_TYPES.map(nt => (
                <button
                  key={nt.value}
                  type="button"
                  onClick={() => setFormType(nt.value as CRMNote['type'])}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 transition ${formType === nt.value ? nt.color + ' ring-2 ring-offset-1 ring-brand-300' : 'bg-slate-100 text-slate-500'}`}
                >
                  <nt.icon className="w-3 h-3" /> {nt.label}
                </button>
              ))}
            </div>
            <textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="Contenu de la note..."
              required
              className="w-full h-24 p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
            />
            {(formType === 'rdv' || formType === 'task') && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Date {formType === 'rdv' ? 'du RDV' : 'échéance'}</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700 transition">
                {editingNote ? 'Modifier' : 'Ajouter'}
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notes Timeline */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400"><Clock className="w-8 h-8 mx-auto mb-2 animate-spin" /> Chargement...</div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Aucune entrée</p>
            <p className="text-xs mt-1">Commencez par ajouter une note ou un rendez-vous.</p>
          </div>
        ) : (
          filteredNotes.map(note => {
            const typeInfo = NOTE_TYPES.find(t => t.value === note.type) || NOTE_TYPES[0];
            const TypeIcon = typeInfo.icon;
            const dateStr = note.createdAt?.toMillis
              ? new Date(note.createdAt.toMillis()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <div key={note.id} className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition group ${note.isDone ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${typeInfo.color}`}>
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${typeInfo.color}`}>{typeInfo.label}</span>
                      {note.dueDate && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(note.dueDate).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                      {note.isDone && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Fait</span>}
                    </div>
                    <p className={`text-sm text-slate-700 whitespace-pre-wrap ${note.isDone ? 'line-through' : ''}`}>{note.text}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {note.authorName}</span>
                      <span>{dateStr}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    {note.type === 'task' && (
                      <button onClick={() => handleToggleDone(note)} className="p-1.5 hover:bg-emerald-50 rounded-lg transition" title={note.isDone ? 'Rouvrir' : 'Marquer fait'}>
                        {note.isDone ? <Square className="w-4 h-4 text-slate-400" /> : <CheckSquare className="w-4 h-4 text-emerald-500" />}
                      </button>
                    )}
                    <button onClick={() => handleEdit(note)} className="p-1.5 hover:bg-blue-50 rounded-lg transition" title="Modifier">
                      <Edit2 className="w-4 h-4 text-blue-500" />
                    </button>
                    <button onClick={() => handleDelete(note)} className="p-1.5 hover:bg-red-50 rounded-lg transition" title="Supprimer">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CRMView;
