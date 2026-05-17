import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertTriangle, AlertCircle, ChevronRight, ChevronDown, Eye, Layers, Fuel, ShoppingBag, XCircle, Plus, ArrowRight, Loader2, ClipboardList } from 'lucide-react';
import { ProfitCenter, FinancialRecord, Month } from '../types';
import {
  ParsedSheet,
  SheetMapping,
  readExcelFile,
  detectSheetType,
  detectYear,
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
  const [yearConfirmed, setYearConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  const formatFileSize = (bytes: number) =>
    (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setSheets([]);
      setMappings([]);
      setYear(defaultYear);
      setYearConfirmed(false);
      setError(null);
      setFileName('');
      setFileSize(null);
      setExpandedSheet(null);
      setIsDragging(false);
    }
  }, [isOpen, defaultYear]);

  const processFile = useCallback(async (file: File) => {
    setError(null);

    // Validate type (.xlsx / .xls)
    const validMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
    if (!hasValidExt && !validMimes.includes(file.type)) {
      setError('Format de fichier invalide. Seuls les fichiers .xlsx ou .xls sont acceptés.');
      return;
    }

    // Validate size (10 MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Fichier trop volumineux (${formatFileSize(file.size)}). Taille maximale : 10 Mo.`);
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    try {
      const parsed = await readExcelFile(file);
      if (parsed.length === 0) {
        setError('Le fichier ne contient aucune feuille.');
        return;
      }

      setSheets(parsed);

      // Auto-detect year from the first meaningful sheet
      const detectedYear = parsed.reduce<number | null>((found, sheet) => {
        if (found) return found;
        const y = detectYear(sheet);
        return y !== new Date().getFullYear() ? y : null;
      }, null) || (parsed.length > 0 ? detectYear(parsed[0]) : defaultYear);
      setYear(detectedYear);

      // Auto-detect mappings
      const detectionResults = parsed.map(sheet => ({
        sheetName: sheet.name,
        detectedType: detectSheetType(sheet),
      }));

      const autoMappings: SheetMapping[] = detectionResults.map(d => ({
        sheetName: d.sheetName,
        type: d.detectedType === 'unknown' ? 'ignore' : d.detectedType,
      })) as SheetMapping[];

      setMappings(autoMappings);
      setStep('mapping');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la lecture du fichier.');
    }
  }, [defaultYear]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  }, [processFile]);

  const updateMapping = useCallback((sheetName: string, type: SheetMapping['type']) => {
    setMappings(prev => prev.map(m => m.sheetName === sheetName ? { ...m, type } : m));
  }, []);

  // Build preview data
  const previewResult = useMemo(() => {
    if (step !== 'preview' || sheets.length === 0) return { data: null, error: null };

    try {
      const result = buildImportData(sheets, mappings, year, clientId, existingRecords, existingProfitCenters);
      return { data: result, error: null };
    } catch (err: any) {
      console.error('Preview build error:', err);
      return { data: null, error: err?.message || 'Erreur lors de la construction des données. Vérifiez le mapping des feuilles.' };
    }
  }, [step, sheets, mappings, year, clientId, existingRecords, existingProfitCenters]);

  const previewData = previewResult.data;

  // Sync error state from preview computation
  useEffect(() => {
    if (step === 'preview') {
      setError(previewResult.error);
    }
  }, [step, previewResult]);

  const handleGoToPreview = useCallback(() => {
    if (!yearConfirmed) {
      setError("Veuillez confirmer l'année d'import avant de continuer.");
      return;
    }
    const hasMapping = mappings.some(m => m.type !== 'ignore');
    if (!hasMapping) {
      setError('Veuillez associer au moins une feuille.');
      return;
    }
    setError(null);
    setStep('preview');
  }, [mappings, yearConfirmed]);

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget && step !== 'importing') onClose(); }}>
      <div className="bg-white rounded-2xl shadow-paper-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-paper-200 bg-paper-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <p className="eyebrow text-paper-500 mb-0.5">Import Données</p>
              <h2 className="font-display text-lg font-semibold text-paper-900 leading-tight">Import Excel Multi-Feuilles</h2>
              <p className="text-xs text-paper-500 mt-0.5">
                {step === 'upload' && 'Chargez votre classeur Excel (.xlsx)'}
                {step === 'mapping' && 'Associez chaque feuille à un type de données'}
                {step === 'preview' && 'Vérifiez les données avant import'}
                {step === 'importing' && 'Import en cours…'}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={step === 'importing'} aria-label="Fermer" title="Fermer" className="p-2 text-paper-400 hover:text-paper-700 hover:bg-paper-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-3 bg-white border-b border-paper-200">
          <div className="flex items-center gap-2 text-xs">
            {['Fichier', 'Mapping', 'Aperçu'].map((label, i) => {
              const stepIdx = ['upload', 'mapping', 'preview', 'importing'].indexOf(step);
              const isActive = i <= stepIdx;
              const isCurrent = i === Math.min(stepIdx, 2);
              return (
                <React.Fragment key={label}>
                  {i > 0 && <ChevronRight className="w-3 h-3 text-paper-300" />}
                  <span className={`px-2 py-1 rounded-full font-bold transition-colors ${isCurrent ? 'bg-brand-100 text-brand-700' : isActive ? 'text-emerald-600' : 'text-paper-400'}`}>
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
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
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
                <div
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center transition-colors ${
                    isDragging
                      ? 'border-brand-400 bg-brand-50/30'
                      : 'border-paper-300 group-hover:border-brand-400 group-hover:bg-brand-50/30'
                  }`}
                >
                  <div className={`p-4 rounded-full mb-4 transition-colors ${isDragging ? 'bg-brand-200' : 'bg-brand-100 group-hover:bg-brand-200'}`}>
                    <Upload className="w-8 h-8 text-brand-600" />
                  </div>
                  <p className="font-display text-xl font-semibold text-paper-900 mb-1">Glissez ou cliquez pour charger</p>
                  <p className="text-sm text-paper-500">Fichiers .xlsx acceptés</p>
                  <p className="text-xs text-paper-500 mt-2">Format : .xlsx ou .xls — Taille max : 10 Mo</p>
                  {fileName && fileSize != null && (
                    <p className="text-xs text-paper-500 mt-3">
                      <span className="font-mono">{fileName}</span>{' '}
                      <span className="text-xs text-paper-500">({formatFileSize(fileSize)})</span>
                    </p>
                  )}
                </div>
              </label>
              <p className="text-xs text-paper-500 mt-6 text-center max-w-md leading-relaxed">
                Le fichier doit contenir des feuilles avec les mois en colonnes (Janvier, Février, etc.)
                et les familles de produits / types de carburant en lignes.
              </p>
            </div>
          )}

          {/* STEP 2: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              {/* Year selector - MANDATORY confirmation */}
              <div className={`p-4 rounded-xl border-2 transition-colors ${yearConfirmed ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    <AlertTriangle className={`w-5 h-5 shrink-0 ${yearConfirmed ? 'text-emerald-600' : 'text-amber-600'}`} />
                    <span className={`text-sm font-bold ${yearConfirmed ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {yearConfirmed ? `Année confirmée : ${year}` : "Confirmez l'année d'import :"}
                    </span>
                  </div>
                  <select
                    value={year}
                    onChange={(e) => { setYear(parseInt(e.target.value)); setYearConfirmed(false); }}
                    className="px-3 py-1.5 rounded-lg border border-paper-300 bg-white font-display font-semibold text-lg text-paper-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
                  >
                    {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 4 + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  {!yearConfirmed && (
                    <button
                      onClick={() => { setYearConfirmed(true); setError(null); }}
                      className="px-4 py-1.5 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" /> Confirmer
                    </button>
                  )}
                </div>
                <p className="text-xs mt-2 ml-7 text-paper-500">
                  Fichier : <span className="font-mono">{fileName}</span>
                  {fileSize != null && (
                    <span className="text-xs text-paper-500"> ({formatFileSize(fileSize)})</span>
                  )}
                </p>
              </div>

              {/* Sheet mappings */}
              <div className="space-y-3">
                {sheets.map(sheet => {
                  const mapping = mappings.find(m => m.sheetName === sheet.name);
                  const isExpanded = expandedSheet === sheet.name;
                  const autoType = detectSheetType(sheet);

                  return (
                    <div key={sheet.name} className="border border-paper-200 rounded-xl overflow-hidden shadow-paper-sm">
                      <div className="flex items-center gap-3 p-4 bg-white">
                        {/* Expand toggle */}
                        <button onClick={() => setExpandedSheet(isExpanded ? null : sheet.name)} aria-label={isExpanded ? 'Replier la feuille' : 'Déplier la feuille'} className="p-1 text-paper-400 hover:text-paper-700 transition-colors">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        {/* Sheet icon */}
                        <div className={`p-1.5 rounded-lg ${mapping?.type === 'analyse_activite' ? 'bg-purple-100 text-purple-600' : mapping?.type === 'revenue_by_family' ? 'bg-emerald-100 text-emerald-600' : mapping?.type === 'fuel_volumes' ? 'bg-blue-100 text-blue-600' : 'bg-paper-100 text-paper-400'}`}>
                          {mapping?.type === 'analyse_activite' ? <ClipboardList className="w-4 h-4" /> :
                           mapping?.type === 'revenue_by_family' ? <ShoppingBag className="w-4 h-4" /> :
                           mapping?.type === 'fuel_volumes' ? <Fuel className="w-4 h-4" /> :
                           <Layers className="w-4 h-4" />}
                        </div>

                        {/* Sheet name */}
                        <div className="flex-1">
                          <span className="text-sm font-bold text-paper-900">{sheet.name}</span>
                          <span className="text-xs text-paper-500 ml-2 font-mono">({sheet.rows.length} lignes, {sheet.headers.length} colonnes)</span>
                          {autoType !== 'unknown' && (
                            <span className="ml-2 text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">auto-détecté</span>
                          )}
                        </div>

                        {/* Type selector */}
                        <select
                          value={mapping?.type || 'ignore'}
                          onChange={(e) => updateMapping(sheet.name, e.target.value as SheetMapping['type'])}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                            mapping?.type === 'analyse_activite'
                              ? 'border-purple-300 bg-purple-50 text-purple-700'
                              : mapping?.type === 'revenue_by_family'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : mapping?.type === 'fuel_volumes'
                              ? 'border-blue-300 bg-blue-50 text-blue-700'
                              : 'border-paper-300 bg-paper-50 text-paper-600'
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
                        <div className="border-t border-paper-200 bg-paper-50 p-4 overflow-x-auto animate-in fade-in slide-in-from-top-2 duration-200">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr>
                                {sheet.headers.slice(0, 14).map((h, i) => (
                                  <th key={i} className="px-2 py-1 text-left font-bold text-paper-700 bg-paper-100 border border-paper-200 whitespace-nowrap">
                                    {h || `Col ${i + 1}`}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sheet.rows.slice(0, 8).map((row, ri) => (
                                <tr key={ri}>
                                  {row.slice(0, 14).map((cell: any, ci: number) => (
                                    <td key={ci} className="px-2 py-1 border border-paper-200 text-paper-700 whitespace-nowrap font-mono">
                                      {typeof cell === 'number' ? formatNum(cell) : String(cell || '')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {sheet.rows.length > 8 && (
                            <p className="text-xs text-paper-500 mt-2">… et {sheet.rows.length - 8} lignes de plus</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Preview - empty state */}
          {step === 'preview' && !previewData && !error && (
            <div className="p-10 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <p className="font-display text-lg font-semibold text-paper-900 mb-1">Aucune donnée détectée</p>
              <p className="text-sm text-paper-500 leading-relaxed">Vérifiez le mapping des feuilles et réessayez.</p>
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && previewData && (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-brand-50 rounded-xl border border-brand-200 text-center shadow-paper-sm">
                  <div className="font-display text-2xl font-semibold text-brand-700 tabular-nums">{previewData.summary.monthCount}</div>
                  <div className="text-xs font-bold text-brand-600 mt-0.5">mois importés</div>
                </div>
                {previewData.summary.hasAnalyseActivite && (
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 text-center shadow-paper-sm">
                    <div className="text-purple-700"><ClipboardList className="w-6 h-6 mx-auto" /></div>
                    <div className="text-xs font-bold text-purple-600 mt-1">Données complètes</div>
                  </div>
                )}
                {previewData.summary.familyCount > 0 && (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center shadow-paper-sm">
                    <div className="font-display text-2xl font-semibold text-emerald-700 tabular-nums">{previewData.summary.familyCount}</div>
                    <div className="text-xs font-bold text-emerald-600 mt-0.5">familles de produits</div>
                  </div>
                )}
                {previewData.summary.newFamilyCount > 0 && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center shadow-paper-sm">
                    <div className="font-display text-2xl font-semibold text-amber-700 flex items-center justify-center gap-1 tabular-nums">
                      <Plus className="w-5 h-5" />
                      {previewData.summary.newFamilyCount}
                    </div>
                    <div className="text-xs font-bold text-amber-600 mt-0.5">nouvelles familles</div>
                  </div>
                )}
                {previewData.summary.hasFuel && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-center shadow-paper-sm">
                    <div className="text-blue-700"><Fuel className="w-6 h-6 mx-auto" /></div>
                    <div className="text-xs font-bold text-blue-600 mt-1">Carburant inclus</div>
                  </div>
                )}
              </div>

              {/* New families alert */}
              {previewData.newProfitCenters.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-bold text-amber-800">Familles de produits à créer automatiquement :</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {previewData.newProfitCenters.map(pc => (
                      <span key={pc.id} className="px-3 py-1 bg-white border border-amber-300 rounded-full text-xs font-bold text-amber-700">
                        {pc.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-amber-700 mt-2 leading-relaxed">
                    Ces familles seront ajoutées aux activités du client. Vous pourrez modifier leur type (Marchandise/Service) dans les paramètres.
                  </p>
                </div>
              )}

              {/* Records preview table */}
              <div className="border border-paper-200 rounded-xl overflow-hidden shadow-paper-sm">
                <div className="bg-paper-50 px-4 py-3 border-b border-paper-200">
                  <p className="eyebrow text-paper-500 mb-0.5">Données à importer</p>
                  <span className="font-display text-sm font-semibold text-paper-900 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-paper-500" />
                    Aperçu des données ({year})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-paper-100">
                        <th className="px-3 py-2 text-left font-bold text-paper-700 border-b border-paper-200">Mois</th>
                        <th className="px-3 py-2 text-right font-bold text-paper-700 border-b border-paper-200">CA Total</th>
                        {previewData.summary.hasAnalyseActivite && (
                          <>
                            <th className="px-3 py-2 text-right font-bold text-purple-600 border-b border-paper-200">Marge</th>
                            <th className="px-3 py-2 text-right font-bold text-paper-700 border-b border-paper-200">Salaires</th>
                            <th className="px-3 py-2 text-right font-bold text-amber-600 border-b border-paper-200">BFR</th>
                            <th className="px-3 py-2 text-right font-bold text-cyan-600 border-b border-paper-200">Trésorerie</th>
                          </>
                        )}
                        {previewData.allProfitCenters.slice(0, 4).map(pc => (
                          <th key={pc.id} className="px-3 py-2 text-right font-bold text-paper-700 border-b border-paper-200 whitespace-nowrap">
                            {pc.name}
                            {previewData.newProfitCenters.some(np => np.id === pc.id) && (
                              <span className="ml-1 text-amber-500">*</span>
                            )}
                          </th>
                        ))}
                        {previewData.summary.hasFuel && (
                          <th className="px-3 py-2 text-right font-bold text-blue-600 border-b border-paper-200">Vol. Carburant</th>
                        )}
                        <th className="px-3 py-2 text-center font-bold text-paper-700 border-b border-paper-200">Statut</th>
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
                            <tr key={record.month} className="hover:bg-paper-50 transition-colors">
                              <td className="px-3 py-2 font-bold text-paper-900 border-b border-paper-100">{record.month}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-brand-700 border-b border-paper-100">
                                {formatNum(record.revenue.total)} {record.revenue.total > 0 ? '€' : '-'}
                              </td>
                              {previewData.summary.hasAnalyseActivite && (
                                <>
                                  <td className="px-3 py-2 text-right font-mono text-purple-600 border-b border-paper-100">
                                    {record.margin?.total ? `${formatNum(record.margin.total)} €` : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-paper-700 border-b border-paper-100">
                                    {record.expenses.salaries ? `${formatNum(record.expenses.salaries)} €` : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-amber-600 border-b border-paper-100">
                                    {record.bfr?.total ? `${formatNum(record.bfr.total)} €` : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-cyan-600 border-b border-paper-100">
                                    {record.cashFlow?.treasury ? `${formatNum(record.cashFlow.treasury)} €` : '-'}
                                  </td>
                                </>
                              )}
                              {previewData.allProfitCenters.slice(0, 4).map(pc => (
                                <td key={pc.id} className="px-3 py-2 text-right font-mono text-paper-700 border-b border-paper-100">
                                  {record.revenue.breakdown?.[pc.id] ? formatNum(record.revenue.breakdown[pc.id]) : '-'}
                                </td>
                              ))}
                              {previewData.summary.hasFuel && (
                                <td className="px-3 py-2 text-right font-mono text-blue-600 border-b border-paper-100">
                                  {record.fuel?.volume ? `${formatNum(record.fuel.volume)} L` : '-'}
                                </td>
                              )}
                              <td className="px-3 py-2 text-center border-b border-paper-100">
                                {existing ? (
                                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Mise à jour</span>
                                ) : (
                                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Nouveau</span>
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
              <p className="font-display text-lg font-semibold text-paper-900">Import en cours…</p>
              <p className="text-sm text-paper-500 mt-1">Sauvegarde des données financières</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-paper-200 bg-paper-50">
          <div>
            {step !== 'upload' && step !== 'importing' && (
              <button
                onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
                className="px-4 py-2 text-sm text-paper-700 font-bold hover:bg-white border border-transparent hover:border-paper-300 rounded-lg transition-colors"
              >
                Retour
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={step === 'importing'} className="px-4 py-2 text-sm text-paper-700 font-bold hover:bg-white border border-paper-300 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Annuler
            </button>
            {step === 'mapping' && (
              <button
                onClick={handleGoToPreview}
                className="px-5 py-2 text-sm text-white font-bold bg-brand-600 hover:bg-brand-700 rounded-lg shadow-paper-sm hover:shadow-paper-md transition-all flex items-center gap-2"
              >
                Aperçu <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 'preview' && previewData && (
              <button
                onClick={handleImport}
                className="px-5 py-2 text-sm text-white font-bold bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-paper-sm hover:shadow-paper-md transition-all flex items-center gap-2"
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
