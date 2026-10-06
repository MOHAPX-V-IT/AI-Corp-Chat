import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocalize } from '~/hooks';
import {
  useListIprEntriesQuery,
  useDeleteIprEntryMutation,
  useUpdateIprEntryMutation,
} from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { Button, useToastContext } from '@librechat/client';
import { ChevronDown, ChevronRight, Search, Loader2, Trash2, X } from 'lucide-react';
import IPRDynamicsDashboard from './IPRDynamicsDashboard';

const CLASSIFICATIONS = [
  'Серия визитов',
  'Двойной визит',
  'Тройной визит',
  'Анализ коучинга',
  'Анализ одного визита',
  'Анализ динамики',
  'Не определено',
];

interface IPRTableProps {
  tab: 'mp' | 'rm' | 'rgr' | 'newcomer';
  managerRole: 'RM' | 'RGR' | 'ROP' | null;
  selectedEntries: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

const IPRTable: React.FC<IPRTableProps> = ({
  tab,
  managerRole,
  selectedEntries,
  onSelectionChange,
}) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { showToast } = useToastContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ iprId: string; field: string } | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const savingRef = useRef(false);
  const [summaryModal, setSummaryModal] = useState<{ iprId: string; text: string; canEdit: boolean } | null>(null);
  const [summaryEditText, setSummaryEditText] = useState('');

  const { data, isLoading, isError, refetch } = useListIprEntriesQuery({
    tab,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: searchQuery || undefined,
    page: currentPage,
    limit: 20,
  });

  const deleteIprEntryMutation = useDeleteIprEntryMutation();
  const updateIprEntryMutation = useUpdateIprEntryMutation();

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setCurrentPage(1);
    },
    [],
  );

  const toggleRow = useCallback((iprId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(iprId)) {
        newSet.delete(iprId);
      } else {
        newSet.add(iprId);
      }
      return newSet;
    });
  }, []);

  const handleDelete = useCallback(
    async (iprId: string, employeeName: string) => {
      if (!confirm(`Удалить запись по сотруднику ${employeeName}?`)) {
        return;
      }
      try {
        await deleteIprEntryMutation.mutateAsync(iprId);
        showToast({ message: 'Запись успешно удалена', status: 'success' });
        refetch();
      } catch (error: any) {
        showToast({ message: error?.message || 'Не удалось удалить запись', status: 'error' });
      }
    },
    [deleteIprEntryMutation, showToast, refetch],
  );

  const canEdit = useCallback(
    (entry: any) => {
      const isAuthor = entry.author?._id === user?.id;
      const isAdmin = user?.role === 'ADMIN';
      return isAuthor || isAdmin;
    },
    [user],
  );

  // Inline editing
  const startEdit = useCallback((iprId: string, field: string, currentValue: any) => {
    setEditingCell({ iprId, field });
    setEditValues((prev) => ({ ...prev, [`${iprId}_${field}`]: currentValue }));
  }, []);

  const saveEdit = useCallback(
    async (iprId: string, field: string) => {
      if (savingRef.current) {
        return;
      }
      savingRef.current = true;
      setEditingCell(null);

      const key = `${iprId}_${field}`;
      let value = editValues[key];

      // Handle focusSkills: split comma-separated string into array
      if (field === 'focusSkills' && typeof value === 'string') {
        value = value
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s);
      }

      try {
        await updateIprEntryMutation.mutateAsync({
          id: iprId,
          params: { [field]: value },
        });
        showToast({ message: localize('com_ipr_edit_saved') || 'Сохранено', status: 'success' });
      } catch (error: any) {
        showToast({
          message: error?.message || localize('com_ipr_edit_failed') || 'Ошибка сохранения',
          status: 'error',
        });
      }
      savingRef.current = false;
    },
    [editValues, updateIprEntryMutation, showToast, localize],
  );

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Checkbox selection
  const toggleSelection = useCallback(
    (iprId: string) => {
      const newSet = new Set(selectedEntries);
      if (newSet.has(iprId)) {
        newSet.delete(iprId);
      } else {
        newSet.add(iprId);
      }
      onSelectionChange(newSet);
    },
    [selectedEntries, onSelectionChange],
  );

  const toggleSelectAll = useCallback(() => {
    if (!data) {
      return;
    }
    const pageIds = data.entries.map((e) => e.ipr_id);
    const allSelected = pageIds.every((id) => selectedEntries.has(id));

    const newSet = new Set(selectedEntries);
    if (allSelected) {
      pageIds.forEach((id) => newSet.delete(id));
    } else {
      pageIds.forEach((id) => newSet.add(id));
    }
    onSelectionChange(newSet);
  }, [data, selectedEntries, onSelectionChange]);

  // Editable cell renderer
  const renderEditableCell = (
    entry: any,
    field: string,
    displayValue: React.ReactNode,
    type: 'text' | 'date' | 'select' | 'skills' = 'text',
  ) => {
    const isEditing = editingCell?.iprId === entry.ipr_id && editingCell?.field === field;
    const key = `${entry.ipr_id}_${field}`;
    const editable = canEdit(entry);

    if (isEditing) {
      const commonProps = {
        autoFocus: true,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter') {
            saveEdit(entry.ipr_id, field);
          }
          if (e.key === 'Escape') {
            cancelEdit();
          }
        },
        onBlur: () => saveEdit(entry.ipr_id, field),
        className:
          'w-full rounded border border-border-heavy bg-surface-secondary px-2 py-1 text-sm text-text-primary focus:outline-none',
      };

      if (type === 'select') {
        return (
          <select
            {...commonProps}
            value={editValues[key] || ''}
            onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
          >
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        );
      }

      if (type === 'date') {
        return (
          <input
            {...commonProps}
            type="date"
            value={editValues[key] || ''}
            onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
          />
        );
      }

      return (
        <input
          {...commonProps}
          type="text"
          value={editValues[key] || ''}
          onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
        />
      );
    }

    return (
      <span
        onClick={() => editable && startEdit(entry.ipr_id, field, type === 'date'
          ? new Date(entry[field]).toISOString().split('T')[0]
          : type === 'skills'
            ? (entry[field] || []).join(', ')
            : entry[field])}
        className={editable ? 'cursor-pointer rounded px-1 hover:bg-surface-hover' : ''}
        title={editable ? 'Нажмите для редактирования' : undefined}
      >
        {displayValue}
      </span>
    );
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            aria-label="Поиск по сотруднику или руководителю"
            value={searchQuery}
            onChange={handleSearch}
            placeholder={localize('com_ipr_search_placeholder')}
            className="w-full rounded-xl border border-border-light bg-surface-primary py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-text-secondary">
            <span>С</span>
            <input
              type="date"
              aria-label="Дата с"
              title="Дата с"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-text-secondary">
            <span>По</span>
            <input
              type="date"
              aria-label="Дата по"
              title="Дата по"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
            />
          </label>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
          <p className="mt-3 text-sm text-text-secondary">Загрузка...</p>
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-lg border border-border-light p-6 text-center">
          <p className="mb-3 text-text-secondary">Не удалось загрузить историю ИПР. Попробуйте ещё раз.</p>
          <Button variant="outline" onClick={() => refetch()}>Повторить загрузку</Button>
        </div>
      ) : data && data.entries && data.entries.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-border-light bg-surface-primary">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-light bg-surface-secondary text-left text-sm font-medium text-text-secondary">
                  <th className="w-8 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={
                        (data.entries || []).length > 0 &&
                        (data.entries || []).every((e) => selectedEntries.has(e.ipr_id))
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer rounded border-gray-300"
                    />
                  </th>
                  <th className="w-8 px-2 py-3"></th>
                  <th className="px-4 py-3">{localize('com_ipr_column_date')}</th>
                  <th className="px-4 py-3">{localize('com_ipr_column_employee')}</th>
                  <th className="px-4 py-3">{localize('com_ipr_column_manager')}</th>
                  <th className="px-4 py-3">{localize('com_ipr_column_classification')}</th>
                  <th className="px-4 py-3">{localize('com_ipr_column_focus')}</th>
                  <th className="px-4 py-3">{localize('com_ipr_column_summary')}</th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => {
                  const isExpanded = expandedRows.has(entry.ipr_id);
                  return (
                    <React.Fragment key={entry.ipr_id}>
                      <tr className="border-b border-border-light text-sm text-text-primary transition-colors hover:bg-surface-hover">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedEntries.has(entry.ipr_id)}
                            onChange={() => toggleSelection(entry.ipr_id)}
                            className="h-4 w-4 cursor-pointer rounded border-gray-300"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => toggleRow(entry.ipr_id)}
                            aria-label={`${isExpanded ? 'Скрыть' : 'Открыть'} разбор: ${entry.employeeName}`}
                            aria-expanded={isExpanded}
                            className="text-text-tertiary hover:text-text-primary"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {renderEditableCell(
                            entry,
                            'eventDate',
                            new Date(entry.eventDate).toLocaleDateString('ru-RU'),
                            'date',
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {renderEditableCell(entry, 'employeeName', entry.employeeName)}
                        </td>
                        <td className="px-4 py-3">
                          {renderEditableCell(entry, 'managerName', entry.managerName)}
                        </td>
                        <td className="px-4 py-3">
                          {renderEditableCell(
                            entry,
                            'classification',
                            <span className="inline-flex rounded-full bg-surface-secondary px-2 py-1 text-xs font-medium text-text-secondary">
                              {entry.classification}
                            </span>,
                            'select',
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {renderEditableCell(
                            entry,
                            'focusSkills',
                            <div className="flex flex-wrap gap-1">
                              {(entry.focusSkills || []).slice(0, 2).map((skill: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                >
                                  {skill}
                                </span>
                              ))}
                              {(entry.focusSkills || []).length > 2 && (
                                <span className="text-xs text-text-tertiary">
                                  +{(entry.focusSkills || []).length - 2}
                                </span>
                              )}
                            </div>,
                            'skills',
                          )}
                        </td>
                        <td className="max-w-[300px] px-4 py-3">
                          <div
                            className="line-clamp-3 cursor-pointer text-sm hover:text-text-primary"
                            title="Нажмите для просмотра / редактирования"
                            onClick={() => setSummaryModal({ iprId: entry.ipr_id, text: entry.summary, canEdit: canEdit(entry) })}
                          >
                            {entry.summary}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {canEdit(entry) && (
                            <button
                              onClick={() => handleDelete(entry.ipr_id, entry.employeeName)}
                              className="text-red-500 hover:text-red-700"
                              title="Удалить"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border-light bg-surface-secondary">
                          <td colSpan={9} className="px-4 py-4">
                            {entry.classification === 'Анализ динамики' ? (
                              (() => {
                                try {
                                  const dynamics = JSON.parse(entry.fullAnalysis);
                                  const dashData = {
                                    employeeName: entry.employeeName,
                                    employeeDepartment: entry.employeeDepartment,
                                    managerName: entry.managerName,
                                    entriesCount: 0,
                                    period: { from: '', to: '', days: 0 },
                                    dynamics,
                                  };
                                  return <IPRDynamicsDashboard data={dashData} />;
                                } catch {
                                  return (
                                    <div className="prose prose-sm dark:prose-invert max-w-none text-text-secondary">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {entry.fullAnalysis}
                                      </ReactMarkdown>
                                    </div>
                                  );
                                }
                              })()
                            ) : (
                              <div className="rounded-lg bg-surface-primary p-4">
                                <h4 className="mb-2 text-sm font-semibold text-text-primary">
                                  {localize('com_ipr_full_analysis')}
                                </h4>
                                <div className="prose prose-sm dark:prose-invert max-w-none text-text-secondary">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {entry.fullAnalysis}
                                  </ReactMarkdown>
                                </div>
                                {(entry.focusSkills || []).length > 0 && (
                                  <div className="mt-3">
                                    <h5 className="mb-2 text-xs font-semibold text-text-tertiary">
                                      {localize('com_ipr_all_focus_skills')}
                                    </h5>
                                    <div className="flex flex-wrap gap-2">
                                      {entry.focusSkills.map((skill: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                {localize('com_ui_prev')}
              </Button>
              <span className="text-sm text-text-secondary">
                {currentPage} / {data.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= data.pages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                {localize('com_ui_next')}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-light bg-surface-primary py-20">
          <h3 className="mb-2 text-lg font-medium text-text-primary">
            {searchQuery || dateFrom || dateTo
              ? localize('com_ipr_no_results')
              : localize('com_ipr_no_entries')}
          </h3>
          <p className="text-sm text-text-secondary">
            {searchQuery || dateFrom || dateTo
              ? localize('com_ipr_try_different_filters')
              : localize('com_ipr_no_entries_description')}
          </p>
          {!(searchQuery || dateFrom || dateTo) && (
            <button
              onClick={() => navigate('/agents')}
              className="mt-4 rounded-lg border border-border-light px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover"
            >
              Перейти к агентам
            </button>
          )}
        </div>
      )}

      {/* Summary Modal */}
      {summaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSummaryModal(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-surface-primary p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Резюме</h3>
              <button onClick={() => setSummaryModal(null)} className="rounded-lg p-1 text-text-secondary hover:bg-surface-hover">
                <X className="h-5 w-5" />
              </button>
            </div>
            {summaryModal.canEdit ? (
              <>
                <textarea
                  className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                  rows={10}
                  defaultValue={summaryModal.text}
                  onChange={(e) => setSummaryEditText(e.target.value)}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setSummaryModal(null)}
                    className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={async () => {
                      if (summaryEditText && summaryEditText !== summaryModal.text) {
                        await updateIprEntryMutation.mutateAsync({ id: summaryModal.iprId, params: { summary: summaryEditText } });
                        showToast({ message: 'Резюме обновлено', status: 'success' });
                        refetch();
                      }
                      setSummaryModal(null);
                    }}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Сохранить
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-text-secondary">{summaryModal.text}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IPRTable;
