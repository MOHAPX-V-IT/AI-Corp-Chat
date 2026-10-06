import React, { useEffect, useRef, useState } from 'react';
import { request } from 'librechat-data-provider';

/**
 * [UI] Автокомплит руководителя для формы новичка.
 * Поиск по имени среди пользователей с руководящей должностью (RM/RGR/ROP/TRAINER),
 * запрос на /api/user/lookup/managers с debounce. Фолбэк: ручной ввод ФИО.
 */
type Manager = { id: string; name: string; position: string; departments: string[] };

interface Props {
  value: string;
  onChange: (name: string, id?: string) => void;
  placeholder?: string;
}

export default function ManagerAutocomplete({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const q = value.trim();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const data: any = await request.get(
          `/api/user/lookup/managers?q=${encodeURIComponent(q)}`,
        );
        setResults(Array.isArray(data?.managers) ? data.managers : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-heavy focus:outline-none"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border-light bg-surface-primary shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-xs text-text-tertiary">Поиск…</div>
          ) : results.length > 0 ? (
            results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.name, m.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-active-alt"
              >
                <span className="truncate">{m.name}</span>
                <span className="flex-shrink-0 rounded bg-green-500/15 px-1.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                  {m.position}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-text-tertiary">
              Не найдено — можно ввести ФИО вручную
            </div>
          )}
        </div>
      )}
    </div>
  );
}
