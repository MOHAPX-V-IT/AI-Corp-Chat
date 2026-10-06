import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLocalize } from '~/hooks';
import {
  useAnalyzeDynamicsMutation,
  useSaveDynamicsMutation,
  useIprEmployeeNamesQuery,
} from '~/data-provider';
import type { IprDynamicsResponse } from '~/data-provider/IPR/types';
import { Button, useToastContext } from '@librechat/client';
import { TrendingUp, Loader2, X, Users, CheckSquare, Download, RotateCcw, Save } from 'lucide-react';
import IPRDynamicsDashboard from './IPRDynamicsDashboard';

interface AnalyzeEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEntryIds: string[];
  activeTab?: 'mp' | 'rm' | 'rgr' | 'newcomer';
}

async function exportToPdf(element: HTMLElement, filename: string) {
  const { toPng } = await import('html-to-image');
  const pdfMake = (await import('pdfmake/build/pdfmake')).default;

  // Remove box-shadows before capture (they render as gray blocks)
  const allElements = element.querySelectorAll('*');
  const savedShadows: Array<{ el: HTMLElement; shadow: string }> = [];
  allElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.style.boxShadow) {
      savedShadows.push({ el: htmlEl, shadow: htmlEl.style.boxShadow });
      htmlEl.style.boxShadow = 'none';
    }
  });

  // Add thin borders instead of shadows
  const addedBorders: HTMLElement[] = [];
  allElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const bg = htmlEl.style.background || htmlEl.style.backgroundColor;
    if (bg && (bg.includes('#ffffff') || bg.includes('white') || bg === '#fff')) {
      if (!htmlEl.style.border) {
        htmlEl.style.border = '1px solid #e2e8f0';
        addedBorders.push(htmlEl);
      }
    }
  });

  const dataUrl = await toPng(element, { quality: 0.92, pixelRatio: 1.5, cacheBust: true });

  // Restore
  savedShadows.forEach(({ el, shadow }) => { el.style.boxShadow = shadow; });
  addedBorders.forEach((el) => { el.style.border = ''; });

  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve) => { img.onload = () => resolve(); });

  const pdfWidth = 595;
  const scale = pdfWidth / img.width;
  const pdfHeight = img.height * scale;

  pdfMake.createPdf({
    pageSize: { width: pdfWidth, height: pdfHeight + 1 },
    pageMargins: [0, 0, 0, 0],
    content: [{ image: dataUrl, width: pdfWidth }],
  }).download(`${filename}.pdf`);
}

const AnalyzeEmployeeModal: React.FC<AnalyzeEmployeeModalProps> = ({
  isOpen,
  onClose,
  selectedEntryIds,
  activeTab,
}) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const analyzeDynamicsMutation = useAnalyzeDynamicsMutation();
  const saveDynamicsMutation = useSaveDynamicsMutation();
  const dashboardRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<'byEmployee' | 'bySelection'>('byEmployee');
  const [employeeName, setEmployeeName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dynamicsResult, setDynamicsResult] = useState<IprDynamicsResponse | null>(null);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const { data: employeesData } = useIprEmployeeNamesQuery(
    activeTab ? { tab: activeTab } : undefined,
    { enabled: isOpen },
  );

  useEffect(() => {
    if (isOpen && selectedEntryIds.length > 0) {
      setMode('bySelection');
    }
  }, [isOpen, selectedEntryIds.length]);

  const isLoading = analyzeDynamicsMutation.isLoading;

  const handleAnalyzeByEmployee = useCallback(async () => {
    if (!employeeName) {
      showToast({
        message: localize('com_ipr_employee_name_required'),
        status: 'error',
      });
      return;
    }

    try {
      const result = await analyzeDynamicsMutation.mutateAsync({
        employeeName,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setDynamicsResult(result);
      showToast({ message: localize('com_ipr_analysis_complete'), status: 'success' });
    } catch (error: any) {
      showToast({
        message: error?.message || localize('com_ipr_analysis_failed'),
        status: 'error',
      });
    }
  }, [employeeName, dateFrom, dateTo, analyzeDynamicsMutation, showToast, localize]);

  const handleAnalyzeBySelection = useCallback(async () => {
    if (selectedEntryIds.length === 0) {
      showToast({
        message: 'Выберите записи в таблице для анализа',
        status: 'error',
      });
      return;
    }

    try {
      const result = await analyzeDynamicsMutation.mutateAsync({
        iprIds: selectedEntryIds,
      });
      setDynamicsResult(result);
      showToast({ message: localize('com_ipr_analysis_complete'), status: 'success' });
    } catch (error: any) {
      showToast({
        message: error?.message || localize('com_ipr_analysis_failed'),
        status: 'error',
      });
    }
  }, [selectedEntryIds, analyzeDynamicsMutation, showToast, localize]);

  const handleAnalyze = mode === 'byEmployee' ? handleAnalyzeByEmployee : handleAnalyzeBySelection;

  const handleClose = useCallback(() => {
    setEmployeeName('');
    setDateFrom('');
    setDateTo('');
    onClose();
  }, [onClose]);

  const handleNewAnalysis = useCallback(() => {
    setDynamicsResult(null);
    setIsSaved(false);
  }, []);

  const handleSaveToIpr = useCallback(async () => {
    if (!dynamicsResult) return;
    try {
      await saveDynamicsMutation.mutateAsync({
        employeeName: dynamicsResult.employeeName,
        employeeDepartment: dynamicsResult.employeeDepartment,
        dynamicsJson: JSON.stringify(dynamicsResult.dynamics),
        period: dynamicsResult.period,
      });
      setIsSaved(true);
      showToast({ message: 'Сохранено в базу ИПР', status: 'success' });
    } catch (error: any) {
      showToast({ message: error?.message || 'Ошибка сохранения', status: 'error' });
    }
  }, [dynamicsResult, saveDynamicsMutation, showToast]);

  const handleExportPdf = useCallback(async () => {
    if (!dashboardRef.current || !dynamicsResult) {
      return;
    }
    setIsPdfExporting(true);
    try {
      const name = dynamicsResult.employeeName.replace(/\s+/g, '_');
      await exportToPdf(dashboardRef.current, `Анализ_динамики_ИПР_${name}`);
      showToast({ message: 'PDF скачан', status: 'success' });
    } catch (error: any) {
      console.error('PDF export error:', error);
      showToast({ message: 'Ошибка при экспорте PDF', status: 'error' });
    } finally {
      setIsPdfExporting(false);
    }
  }, [dynamicsResult, showToast]);

  if (!isOpen) {
    return null;
  }

  // Dashboard mode — centered, same width as main content area
  if (dynamicsResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-6">
        <div className="mx-4 flex w-full max-w-[1060px] max-h-[92vh] flex-col overflow-hidden rounded-xl bg-surface-primary shadow-2xl">
          {/* Dashboard Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border-light px-6 py-3">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-text-secondary" />
              <h2 className="text-lg font-semibold text-text-primary">
                Динамика ИПР — {dynamicsResult.employeeName}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewAnalysis}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover"
              >
                <RotateCcw className="h-4 w-4" />
                Новый анализ
              </button>
              <button
                onClick={handleExportPdf}
                disabled={isPdfExporting}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPdfExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Скачать PDF
              </button>
              <button
                onClick={handleSaveToIpr}
                disabled={saveDynamicsMutation.isLoading || isSaved}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saveDynamicsMutation.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaved ? 'Сохранено' : 'Сохранить в ИПР'}
              </button>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="flex-1 overflow-y-auto">
            <IPRDynamicsDashboard ref={dashboardRef} data={dynamicsResult} />
          </div>
        </div>
      </div>
    );
  }

  // Standard form mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-surface-primary p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-text-secondary" />
            <h2 className="text-lg font-semibold text-text-primary">
              {localize('com_ipr_analyze_employee_title')}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-text-secondary hover:bg-surface-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setMode('byEmployee')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              mode === 'byEmployee'
                ? 'bg-surface-tertiary font-medium text-text-primary'
                : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            {localize('com_ipr_mode_by_employee') || 'По сотруднику'}
          </button>
          <button
            onClick={() => setMode('bySelection')}
            disabled={selectedEntryIds.length === 0}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              mode === 'bySelection'
                ? 'bg-surface-tertiary font-medium text-text-primary'
                : 'text-text-secondary hover:bg-surface-hover'
            } ${selectedEntryIds.length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {localize('com_ipr_mode_by_selection') || 'По выбранным записям'}
            {selectedEntryIds.length > 0 && (
              <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                {selectedEntryIds.length}
              </span>
            )}
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'byEmployee' ? (
            <>
              {/* Employee Name Dropdown */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  {localize('com_ipr_employee_name')}
                </label>
                <select
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                >
                  <option value="">
                    {localize('com_ipr_select_employee') || 'Выберите сотрудника'}
                  </option>
                  {employeesData?.names.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-primary">
                    {localize('com_ipr_date_from')}
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-primary">
                    {localize('com_ipr_date_to')}
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                  />
                </div>
              </div>
            </>
          ) : (
            /* Mode B: By Selection — Dynamics Dashboard */
            <div className="rounded-lg border border-border-light bg-surface-secondary p-4">
              <p className="text-sm text-text-secondary">
                Анализ динамики ИПР по выбранным записям (визуальный дашборд)
              </p>
              <p className="mt-2 text-lg font-semibold text-text-primary">
                {selectedEntryIds.length}{' '}
                {selectedEntryIds.length === 1
                  ? 'запись'
                  : selectedEntryIds.length < 5
                    ? 'записи'
                    : 'записей'}
              </p>
            </div>
          )}

          {/* Analyze Button */}
          <Button onClick={handleAnalyze} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'bySelection' ? 'Анализ динамики...' : localize('com_ipr_analyzing')}
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                {mode === 'bySelection'
                  ? 'Анализировать динамику'
                  : localize('com_ipr_analyze_button')}
              </>
            )}
          </Button>

        </div>
      </div>
    </div>
  );
};

export default AnalyzeEmployeeModal;
