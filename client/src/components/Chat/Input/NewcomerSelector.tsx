import React, { useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { UserPlus } from 'lucide-react';
import { useActiveNewcomersQuery } from '~/data-provider';
import store from '~/store';

const NewcomerSelector: React.FC = () => {
  const [selectedId, setSelectedId] = useRecoilState(store.selectedNewcomerProfileId);
  const { data, isLoading } = useActiveNewcomersQuery();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedId(e.target.value || null);
    },
    [setSelectedId],
  );

  const profiles = data?.profiles || [];

  return (
    <div
      className="flex items-center gap-2 border-b border-border-light bg-surface-primary-alt px-4 py-2"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <UserPlus className="h-4 w-4 text-text-secondary" />
      <span className="text-sm text-text-secondary">Новичок:</span>
      <select
        value={selectedId || ''}
        onChange={handleChange}
        disabled={isLoading}
        className="flex-1 rounded-md border border-border-light bg-surface-primary px-2 py-1 text-sm text-text-primary"
      >
        <option value="">
          {isLoading ? 'Загрузка...' : 'Выберите сотрудника'}
        </option>
        {profiles.map((p) => (
          <option key={p.profile_id} value={p.profile_id}>
            {p.name} ({p.department} — {p.status === 'candidate' ? 'Кандидат' : p.status === 'onboarding' ? 'Адаптация' : p.status === 'probation' ? 'Испыт. срок' : p.status})
          </option>
        ))}
      </select>
      {!selectedId && profiles.length > 0 && (
        <span className="text-xs text-orange-500">Выберите новичка для работы</span>
      )}
    </div>
  );
};

export default NewcomerSelector;
