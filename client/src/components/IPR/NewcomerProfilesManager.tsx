import React, { useState, useCallback } from 'react';
import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import { Button, useToastContext } from '@librechat/client';
import {
  useListNewcomerProfilesQuery,
  useCreateNewcomerProfileMutation,
  useUpdateNewcomerProfileMutation,
  useDeleteNewcomerProfileMutation,
} from '~/data-provider';
import { Search, Loader2, Trash2, Pencil, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import ManagerAutocomplete from './ManagerAutocomplete';

const DEPARTMENTS = [
  { value: 'MP', label: 'МП' },
  { value: 'RM', label: 'РМ' },
  { value: 'RGR', label: 'РГР' },
  { value: 'ROP', label: 'РОП' },
  { value: 'HR', label: 'HR' },
  { value: 'PRODUCTION', label: 'Производство' },
];

const STATUSES = [
  { value: 'candidate', labelKey: 'com_newcomer_status_candidate' },
  { value: 'onboarding', labelKey: 'com_newcomer_status_onboarding' },
  { value: 'probation', labelKey: 'com_newcomer_status_probation' },
  { value: 'completed', labelKey: 'com_newcomer_status_completed' },
] as const;

const statusColors: Record<string, string> = {
  candidate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  onboarding: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  probation: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

interface ProfileFormData {
  name: string;
  rm: string;
  department: string;
  startDate: string;
  resumeText: string;
  bigFiveResults: string;
  managerComments: string;
  status: string;
}

const emptyForm: ProfileFormData = {
  name: '',
  rm: '',
  department: 'MP',
  startDate: '',
  resumeText: '',
  bigFiveResults: '',
  managerComments: '',
  status: 'candidate',
};

const NewcomerProfilesManager: React.FC = () => {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { showToast } = useToastContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>(emptyForm);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useListNewcomerProfilesQuery({
    search: searchQuery || undefined,
    status: statusFilter || undefined,
    page: currentPage,
    limit: 20,
  });

  const createMutation = useCreateNewcomerProfileMutation();
  const updateMutation = useUpdateNewcomerProfileMutation();
  const deleteMutation = useDeleteNewcomerProfileMutation();

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleOpenCreate = useCallback(() => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((profile: any) => {
    setFormData({
      name: profile.name,
      rm: profile.rm,
      department: profile.department,
      startDate: profile.startDate ? new Date(profile.startDate).toISOString().split('T')[0] : '',
      resumeText: profile.resumeText || '',
      bigFiveResults: profile.bigFiveResults || '',
      managerComments: profile.managerComments || '',
      status: profile.status,
    });
    setEditingId(profile.profile_id);
    setShowForm(true);
  }, []);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name || !formData.rm || !formData.department || !formData.startDate) {
      showToast({ message: 'Заполните все обязательные поля', status: 'warning' });
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          params: formData,
        });
        showToast({ message: localize('com_newcomer_updated'), status: 'success' });
      } else {
        await createMutation.mutateAsync(formData);
        showToast({ message: localize('com_newcomer_created'), status: 'success' });
      }
      handleCancel();
      refetch();
    } catch (error: any) {
      showToast({ message: error?.message || 'Ошибка сохранения', status: 'error' });
    }
  }, [formData, editingId, updateMutation, createMutation, showToast, localize, handleCancel, refetch]);

  const handleDelete = useCallback(
    async (profileId: string, name: string) => {
      if (!confirm(`${localize('com_newcomer_delete_confirm')} "${name}"?`)) {
        return;
      }
      try {
        await deleteMutation.mutateAsync(profileId);
        showToast({ message: localize('com_newcomer_deleted'), status: 'success' });
        refetch();
      } catch (error: any) {
        showToast({ message: error?.message || 'Ошибка удаления', status: 'error' });
      }
    },
    [deleteMutation, showToast, localize, refetch],
  );

  const toggleRow = useCallback((profileId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(profileId)) {
        newSet.delete(profileId);
      } else {
        newSet.add(profileId);
      }
      return newSet;
    });
  }, []);

  const canEdit = useCallback(
    (profile: any) => {
      const isAuthor = profile.createdBy?._id === user?.id;
      const isAdmin = user?.role === 'ADMIN';
      return isAuthor || isAdmin;
    },
    [user],
  );

  const getStatusLabel = (status: string) => {
    const s = STATUSES.find((s) => s.value === status);
    return s ? localize(s.labelKey) : status;
  };

  const getDepartmentLabel = (dept: string) => {
    const d = DEPARTMENTS.find((d) => d.value === dept);
    return d ? d.label : dept;
  };

  return (
    <div>
      {/* Header with filters and add button */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder={localize('com_newcomer_search_placeholder')}
            className="w-full rounded-xl border border-border-light bg-surface-primary py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="rounded-xl border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
        >
          <option value="">Все статусы</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {localize(s.labelKey)}
            </option>
          ))}
        </select>
        <Button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl px-4 py-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          {localize('com_newcomer_add_profile')}
        </Button>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleCancel}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-surface-primary p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">
                {editingId ? localize('com_newcomer_edit') : localize('com_newcomer_add_profile')}
              </h3>
              <button onClick={handleCancel} className="rounded-lg p-1 text-text-secondary hover:bg-surface-hover">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  {localize('com_newcomer_name')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                  placeholder="Иванов Иван Иванович"
                />
              </div>

              {/* RM + Department row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    {localize('com_newcomer_rm')} *
                  </label>
                  <ManagerAutocomplete
                    value={formData.rm}
                    onChange={(name) => setFormData((prev) => ({ ...prev, rm: name }))}
                    placeholder="Начните вводить ФИО руководителя…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    {localize('com_newcomer_department')} *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start date + Status row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    {localize('com_newcomer_start_date')} *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    {localize('com_newcomer_status')}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {localize(s.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Resume */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  {localize('com_newcomer_resume')}
                </label>
                <textarea
                  value={formData.resumeText}
                  onChange={(e) => setFormData((prev) => ({ ...prev, resumeText: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                  placeholder="Вставьте текст резюме сотрудника..."
                />
              </div>

              {/* Big Five — 5 полей (0–10). Свободный текст старых профилей сохраняется. */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  {localize('com_newcomer_big_five')}
                </label>
                {(() => {
                  const TRAITS = [
                    'Открытость',
                    'Добросовестность',
                    'Экстраверсия',
                    'Доброжелательность',
                    'Нейротизм',
                  ];
                  const val = formData.bigFiveResults || '';
                  const isStructured =
                    !val || TRAITS.some((t) => new RegExp(`${t}:\\s*\\d`).test(val));
                  if (!isStructured) {
                    // Легаси: свободный текст — оставляем как есть, ничего не теряем.
                    return (
                      <textarea
                        value={val}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, bigFiveResults: e.target.value }))
                        }
                        rows={3}
                        className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                        placeholder="Результаты теста Big Five..."
                      />
                    );
                  }
                  const parsed: Record<string, string> = Object.fromEntries(
                    TRAITS.map((t) => [t, (val.match(new RegExp(`${t}:\\s*(\\d+)`)) || [])[1] || '']),
                  );
                  const setTrait = (trait: string, raw: string) => {
                    const next = { ...parsed, [trait]: raw.replace(/[^0-9]/g, '').slice(0, 2) };
                    const str = TRAITS.filter((t) => next[t] !== '')
                      .map((t) => `${t}: ${next[t]}/10`)
                      .join('; ');
                    setFormData((prev) => ({ ...prev, bigFiveResults: str }));
                  };
                  return (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {TRAITS.map((t) => (
                        <div key={t}>
                          <div className="mb-1 truncate text-xs text-text-tertiary" title={t}>
                            {t}
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={parsed[t]}
                            onChange={(e) => setTrait(t, e.target.value)}
                            placeholder="0–10"
                            aria-label={t}
                            className="w-full rounded-lg border border-border-light bg-surface-secondary px-2 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Manager comments */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  {localize('com_newcomer_manager_comments')}
                </label>
                <textarea
                  value={formData.managerComments}
                  onChange={(e) => setFormData((prev) => ({ ...prev, managerComments: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
                  placeholder="Комментарии руководителя о сотруднике..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover"
              >
                {localize('com_newcomer_cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={createMutation.isLoading || updateMutation.isLoading}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {createMutation.isLoading || updateMutation.isLoading ? 'Сохраняем...' : localize('com_newcomer_save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
          <p className="mt-3 text-sm text-text-secondary">Загрузка...</p>
        </div>
      ) : data && data.profiles && data.profiles.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-border-light bg-surface-primary">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-light bg-surface-secondary text-left text-sm font-medium text-text-secondary">
                  <th className="w-8 px-2 py-3"></th>
                  <th className="px-4 py-3">{localize('com_newcomer_name')}</th>
                  <th className="px-4 py-3">{localize('com_newcomer_rm')}</th>
                  <th className="px-4 py-3">{localize('com_newcomer_department')}</th>
                  <th className="px-4 py-3">{localize('com_newcomer_start_date')}</th>
                  <th className="px-4 py-3">{localize('com_newcomer_status')}</th>
                  <th className="w-24 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.profiles.map((profile) => {
                  const isExpanded = expandedRows.has(profile.profile_id);
                  return (
                    <React.Fragment key={profile.profile_id}>
                      <tr className="border-b border-border-light text-sm text-text-primary transition-colors hover:bg-surface-hover">
                        <td className="px-2 py-3">
                          <button
                            onClick={() => toggleRow(profile.profile_id)}
                            className="text-text-tertiary hover:text-text-primary"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium">{profile.name}</td>
                        <td className="px-4 py-3">{profile.rm}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {getDepartmentLabel(profile.department)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {new Date(profile.startDate).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColors[profile.status] || ''}`}>
                            {getStatusLabel(profile.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {canEdit(profile) && (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(profile)}
                                  className="text-text-secondary hover:text-text-primary"
                                  title={localize('com_newcomer_edit')}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(profile.profile_id, profile.name)}
                                  className="text-red-500 hover:text-red-700"
                                  title="Удалить"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border-light bg-surface-secondary">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              {profile.resumeText && (
                                <div className="rounded-lg bg-surface-primary p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-text-primary">
                                    {localize('com_newcomer_resume')}
                                  </h4>
                                  <p className="whitespace-pre-wrap text-sm text-text-secondary">
                                    {profile.resumeText}
                                  </p>
                                </div>
                              )}
                              {profile.bigFiveResults && (
                                <div className="rounded-lg bg-surface-primary p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-text-primary">
                                    {localize('com_newcomer_big_five')}
                                  </h4>
                                  <p className="whitespace-pre-wrap text-sm text-text-secondary">
                                    {profile.bigFiveResults}
                                  </p>
                                </div>
                              )}
                              {profile.managerComments && (
                                <div className="rounded-lg bg-surface-primary p-4 md:col-span-2">
                                  <h4 className="mb-2 text-sm font-semibold text-text-primary">
                                    {localize('com_newcomer_manager_comments')}
                                  </h4>
                                  <p className="whitespace-pre-wrap text-sm text-text-secondary">
                                    {profile.managerComments}
                                  </p>
                                </div>
                              )}
                              {!profile.resumeText && !profile.bigFiveResults && !profile.managerComments && (
                                <p className="text-sm text-text-tertiary md:col-span-2">
                                  Дополнительная информация не заполнена
                                </p>
                              )}
                            </div>
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
                Назад
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
                Далее
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-light bg-surface-primary py-20">
          <h3 className="mb-2 text-lg font-medium text-text-primary">
            {searchQuery || statusFilter
              ? localize('com_ipr_no_results')
              : localize('com_newcomer_no_profiles')}
          </h3>
          <p className="text-sm text-text-secondary">
            {searchQuery || statusFilter
              ? localize('com_ipr_try_different_filters')
              : localize('com_newcomer_no_profiles_description')}
          </p>
        </div>
      )}
    </div>
  );
};

export default NewcomerProfilesManager;
