import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertTriangle, ChevronRight, ChevronDown, Eye, Layers, Fuel, ShoppingBag, XCircle, Plus, ArrowRight, Loader2, ClipboardList } from 'lucide-react';
import { ProfitCenter, FinancialRecord, Month } from '../types';
import {
  ParsedSheet,
  SheetMapping,
  readExcelFile,
  detectSheetType,
  parseRevenueSheet,
  parseFuelSheet,
  buildImportData,
} from '../services/excelImportService';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: FinancialRecord[], newProfitCenters: ProfitCenter[], allProfitCenters: ProfitCenter[]) => void;
  clientId: string;
  existingRecords: FinancialRecord[];
  existingProfitCenters: ProfitCenter[];
  year: number;
}

const formatNum = (val: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(val);

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  clientId,
  existingRecords,
  existingProfitCenters,
  year: defaultYear,
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [mappings, setMappings] = useState<SheetMapping[]>([]);
  const [year, setYear] = useState(defaultYear);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setSheets([]);
      setMappings([]);
      setYear(defaultYear);
      setError(null);
      setFileName('');
      setExpandedSheet(null);
    }
  }, [isOpen, defaultYear]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    try {
      const parsed = await readExcelFile(file);
      if (parsed.length === 0) {
        setError('Le fichier ne contient aucune feuille.');
        return;
      }

      setSheets(parsed);

      // Auto-detect mappings
      const detectionResults = parsed.map(sheet => ({
        sheetName: sheet.name,
        detectedType: detectSheetType(sheet),
      }));
      console.log('[AutoDetect] Detection results:', detectionResults);

      const autoMappings: SheetMapping[] = detectionResults.map(d => ({
        sheetName: d.sheetName,
        type: d.detectedType === 'unknown' ? 'ignore' : d.detectedType,
      })) as SheetMapping[];

      console.log('[AutoDetect] Final mappings:', autoMappings.map(m => `${m.sheetName} → ${m.type}`));
      setMappings(autoMappings);
      setStep('mapping');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la lecture du fichier.');
    }

    // Reset input
    e.target.value = '';
  }, []);

  const updateMapping = useCallback((sheetName: string, type: SheetMapping['type']) => {
    setMappings(prev => prev.map(m => m.sheetName === sheetName ? { ...m, type } : m));
  }, []);

  // Build preview data
  const previewData = useMemo(() => {
    if (step !== 'preview' || sheets.length === 0) return null;

    try {
      return buildImportData(sheets, mappings, year, clientId, existingRecords, existingProfitCenters);
    } catch (err) {
      return null;
    }
  }, [step, sheets, mappings, year, clientId, existingRecords, existingProfitCenters]);

  const handleGoToPreview = useCallback(() => {
    const hasMapping = mappings.some(m => m.type !== 'ignore');
    if (!hasMapping) {
      setError('Veuillez associer au moins une feuille.');
      return;
    }
    setError(null);
    setStep('preview');
  }, [mappings]);

  const handleImport = useCallback(() => {
    if (!previewData) return;
    setStep('importing');
    // Small delay for UI feedback
    setTimeout(() => {
      onImport(previewData.records, previewData.newProfitCenters, previewData.allProfitCenters);
    }, 300);
  }, [previewData, onImport]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Import Excel Multi-Feuilles</h2>
              <p className="text-xs text-slate-500">
                {step === 'upload' && 'Chargez votre classeur Excel (.xlsx)'}
                {step === 'mapping' && 'Associez chaque feuille à un type de données'}
                {step === 'preview' && 'Vérifiez les données avant import'}
                {step === 'importing' && 'Import en cours...'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-3 bg-white border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs">
            {['Fichier', 'Mapping', 'Apercu'].map((label, i) => {
              const stepIdx = ['upload', 'mapping', 'preview', 'importing'].indexOf(step);
              const isActive = i <= stepIdx;
              const isCurrent = i === Math.min(stepIdx, 2);
              return (
                <React.Fragment key={label}>
                  {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                  <span className={`px-2 py-1 rounded-full font-bold ${isCurrent ? 'bg-brand-100 text-brand-700' : isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {isActive && i < stepIdx ? <CheckCircle className="w-3 h-3 inline mr-1" /> : null}
                    {label}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12">
              <label className="cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-slate-300 group-hover:border-brand-400 rounded-2xl p-12 flex flex-col items-center transition-colors group-hover:bg-brand-50/30">
                  <div className="p-4 bg-brand-100 rounded-full mb-4 group-hover:bg-brand-200 transition">
                    <Upload className="w-8 h-8 text-brand-600" />
                  </div>
                  <p className="text-base font-bold text-slate-700 mb-1">Glissez ou cliquez pour charger</p>
                  <p className="text-sm text-slate-500">Fichiers .xlsx acceptés</p>
                </div>
              </label>
              <p className="text-xs text-slate-400 mt-6 text-center max-w-md">
                Le fichier doit contenir des feuilles avec les mois en colonnes (Janvier, Février, etc.)
                et les familles de produits / types de carburant en lignes.
              </p>
            </div>
          )}

          {/* STEP 2: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              {/* Year selector */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-sm font-bold text-slate-700">Année d'import :</span>
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-sm text-slate-700 focus:ring-2 focus:ring-brand-500"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">({fileName})</span>
              </div>

              {/* Sheet mappings */}
              <div className="space-y-3">
                {sheets.map(sheet => {
                  const mapping = mappings.find(m => m.sheetName === sheet.name);
                  const isExpanded = expandedSheet === sheet.name;
                  const autoType = detectSheetType(sheet);

                  return (
                    <div key={sheet.name} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 p-4 bg-white">
                        {/* Expand toggle */}
                        <button onClick={() => setExpandedSheet(isExpanded ? null : sheet.name)} className="p-1 text-slate-400 hover:text-slate-600 transition">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        {/* Sheet icon */}
                        <div className={`p-1.5 rounded-lg ${mapping?.type === 'analyse_activite' ? 'bg-purple-100 text-purple-600' : mapping?.type === 'revenue_by_family' ? 'bg-emerald-100 text-emerald-600' : mapping?.type === 'fuel_volumes' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                          {mapping?.type === 'analyse_activite' ? <ClipboardList className="w-4 h-4" /> :
                           mapping?.type === 'revenue_by_family' ? <ShoppingBag className="w-4 h-4" /> :
                           mapping?.type === 'fuel_volumes' ? <Fuel className="w-4 h-4" /> :
                           <Layers className="w-4 h-4" />}
                        </div>

                        {/* Sheet name */}
                        <div className="flex-1">
                          <span className="text-sm font-bold text-slate-800">{sheet.name}</span>
                          <span className="text-[10px] text-slate-400 ml-2">({sheet.rows.length} lignes, {sheet.headers.length} colonnes)</span>
                          {autoType !== 'unknown' && (
                            <span className="ml-2 text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">auto-détecté</span>
                          )}
                        </div>

                        {/* Type selector */}
                        <select
                          value={mapping?.type || 'ignore'}
                          onChange={(e) => updateMapping(sheet.name, e.target.value as SheetMapping['type'])}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                            mapping?.type === 'analyse_activite'
                              ? 'border-purple-300 bg-purple-50 text-purple-700'
                              : mapping?.type === 'revenue_by_family'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : mapping?.type === 'fuel_volumes'
                              ? 'border-blue-300 bg-blue-50 text-blue-700'
                              : 'border-slate-300 bg-slate-50 text-slate-500'
                          }`}
                        >
                          <option value="ignore">Ignorer</option>
                          <option value="analyse_activite">Feuille de Saisie</option>
                          <option value="revenue_by_family">CA par Famille</option>
                          <option value="fuel_volumes">Volumes Carburant</option>
                        </select>
                      </div>

                      {/* Preview when expanded */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50 p-4 overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr>
                                {sheet.headers.slice(0, 14).map((h, i) => (
                                  <th key={i} className="px-2 py-1 text-left font-bold text-slate-600 bg-slate-100 border border-slate-200 whitespace-nowrap">
                                    {h || `Col ${i + 1}`}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sheet.rows.slice(0, 8).map((row, ri) => (
                                <tr key={ri}>
                                  {row.slice(0, 14).map((cell: any, ci: number) => (
                                    <td key={ci} className="px-2 py-1 border border-slate-200 text-slate-700 whitespace-nowrap">
                                      {typeof cell === 'number' ? formatNum(cell) : String(cell || '')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {sheet.rows.length > 8 && (
                            <p className="text-[10px] text-slate-400 mt-2">... et {sheet.rows.length - 8} lignes de plus</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && previewData && (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-brand-50 rounded-xl border border-brand-200 text-center">
                  <div className="text-2xl font-bold text-brand-700">{previewData.summary.monthCount}</div>
                  <div className="text-xs font-bold text-brand-600">mois importes</div>
                </div>
                {previewData.summary.hasAnalyseActivite && (
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 text-center">
                    <div className="text-2xl font-bold text-purple-700"><ClipboardList className="w-6 h-6 mx-auto" /></div>
                    <div className="text-xs font-bold text-purple-600">Donnees completes</div>
                  </div>
                )}
                {previewData.summary.familyCount > 0 && (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                    <div className="text-2xl font-bold text-emerald-700">{previewData.summary.familyCount}</div>
                    <div className="text-xs font-bold text-emerald-600">familles de produits</div>
                  </div>
                )}
                {previewData.summary.newFamilyCount > 0 && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
                    <div className="text-2xl font-bold text-amber-700 flex items-center justify-center gap-1">
                      <Plus className="w-5 h-5" />
                      {previewData.summary.newFamilyCount}
                    </div>
                    <div className="text-xs font-bold text-amber-600">nouvelles familles</div>
                  </div>
                )}
                {previewData.summary.hasFuel && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-center">
                    <div className="text-2xl font-bold text-blue-700"><Fuel className="w-6 h-6 mx-auto" /></div>
                    <div className="text-xs font-bold text-blue-600">Carburant inclus</div>
                  </div>
                )}
              </div>

              {/* New families alert */}
              {previewData.newProfitCenters.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-bold text-amber-800">Familles de produits a creer automatiquement :</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {previewData.newProfitCenters.map(pc => (
                      <span key={pc.id} className="px-3 py-1 bg-white border border-amber-300 rounded-full text-xs font-bold text-amber-700">
                        {pc.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-600 mt-2">
                    Ces familles seront ajoutees aux activites du client. Vous pourrez modifier leur type (Marchandise/Service) dans les parametres.
                  </p>
                </div>
              )}

              {/* Records preview table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <span className="text-sm font-bold text-slate-700">
                    <Eye className="w-4 h-4 inline mr-1" />
                    Apercu des donnees ({year})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2 text-left font-bold text-slate-600 border-b border-slate-200">Mois</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-600 border-b border-slate-200">CA Total</th>
                        {previewData.summary.hasAnalyseActivite && (
                          <>
                            <th className="px-3 py-2 text-right font-bold text-purple-600 border-b border-slate-200">Marge</th>
                            <th className="px-3 py-2 text-right font-bold text-purple-600 border-b border-slate-200">Salaires</th>
                          </>
                        )}
                        {previewData.allProfitCenters.slice(0, 4).map(pc => (
                          <th key={pc.id} className="px-3 py-2 text-right font-bold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                            {pc.name}
                            {previewData.newProfitCenters.some(np => np.id === pc.id) && (
                              <span className="ml-1 text-amber-500">*</span>
                            )}
                          </th>
                        ))}
                        {previewData.summary.hasFuel && (
                          <th className="px-3 py-2 text-right font-bold text-blue-600 border-b border-slate-200">Vol. Carburant</th>
                        )}
                        <th className="px-3 py-2 text-center font-bold text-slate-600 border-b border-slate-200">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.records
                        .sort((a, b) => {
                          const months = Object.values(Month);
                          return months.indexOf(a.month) - months.indexOf(b.month);
                        })
                        .map(record => {
                          const existing = existingRecords.find(r => r.year === year && r.month === record.month);
                          return (
                            <tr key={record.month} className="hover:bg-slate-50 transition">
                              <td className="px-3 py-2 font-bold text-slate-800 border-b border-slate-100">{record.month}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-brand-700 border-b border-slate-100">
                                {formatNum(record.revenue.total)} {record.revenue.total > 0 ? '€' : '-'}
                              </td>
                              {previewData.summary.hasAnalyseActivite && (
                                <>
                                  <td className="px-3 py-2 text-right font-mono text-purple-600 border-b border-slate-100">
                                    {record.margin?.total ? `${formatNum(record.margin.total)} €` : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-purple-600 border-b border-slate-100">
                                    {record.expenses.salaries ? `${formatNum(record.expenses.salaries)} €` : '-'}
                                  </td>
                                </>
                              )}
                              {previewData.allProfitCenters.slice(0, 4).map(pc => (
                                <td key={pc.id} className="px-3 py-2 text-right font-mono text-slate-600 border-b border-slate-100">
                                  {record.revenue.breakdown?.[pc.id] ? formatNum(record.revenue.breakdown[pc.id]) : '-'}
                                </td>
                              ))}
                              {previewData.summary.hasFuel && (
                                <td className="px-3 py-2 text-right font-mono text-blue-600 border-b border-slate-100">
                                  {record.fuel?.volume ? `${formatNum(record.fuel.volume)} L` : '-'}
                                </td>
                              )}
                              <td className="px-3 py-2 text-center border-b border-slate-100">
                                {existing ? (
                                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Mise a jour</span>
                                ) : (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Nouveau</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-4" />
              <p className="text-lg font-bold text-slate-700">Import en cours...</p>
              <p className="text-sm text-slate-500">Sauvegarde des donnees financieres</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div>
            {step !== 'upload' && step !== 'importing' && (
              <button
                onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
                className="px-4 py-2 text-sm text-slate-600 font-bold hover:bg-white border border-transparent hover:border-slate-300 rounded-lg transition"
              >
                Retour
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 font-bold hover:bg-white border border-slate-300 rounded-lg transition">
              Annuler
            </button>
            {step === 'mapping' && (
              <button
                onClick={handleGoToPreview}
                className="px-5 py-2 text-sm text-white font-bold bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition flex items-center gap-2"
              >
                Apercu <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 'preview' && previewData && (
              <button
                onClick={handleImport}
                className="px-5 py-2 text-sm text-white font-bold bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Importer {previewData.summary.monthCount} mois
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal;
