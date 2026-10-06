import React, { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Checkbox } from '@librechat/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AgentForm } from '~/common';
import { cn } from '~/utils';

const DEPARTMENTS = [
  { value: 'MP', label: 'МП - Медицинский представитель' },
  { value: 'RM', label: 'РМ - Региональный менеджер' },
  { value: 'RGR', label: 'РГР - Руководитель группы регионов' },
  { value: 'ROP', label: 'РОП - Руководитель продаж' },
  { value: 'HR', label: 'HR - HR менеджер' },
  { value: 'PRODUCTION', label: 'Производство' },
];

interface DepartmentSelectorProps {
  className?: string;
}

export default function DepartmentSelector({ className }: DepartmentSelectorProps) {
  const { control } = useFormContext<AgentForm>();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <Controller
        name="departments"
        control={control}
        render={({ field }) => {
          const selectedDepartments = field.value || [];

          const toggleDepartment = (deptValue: string) => {
            const newDepartments = selectedDepartments.includes(deptValue)
              ? selectedDepartments.filter((d) => d !== deptValue)
              : [...selectedDepartments, deptValue];
            field.onChange(newDepartments);
          };

          const selectAll = () => {
            if (selectedDepartments.length === DEPARTMENTS.length) {
              field.onChange([]);
            } else {
              field.onChange(DEPARTMENTS.map((d) => d.value));
            }
          };

          const isAllSelected = selectedDepartments.length === DEPARTMENTS.length;

          const getDisplayText = () => {
            if (selectedDepartments.length === 0) {
              return 'Выберите отделы *';
            }
            if (selectedDepartments.length === DEPARTMENTS.length) {
              return 'Все отделы';
            }
            if (selectedDepartments.length === 1) {
              const dept = DEPARTMENTS.find((d) => d.value === selectedDepartments[0]);
              return dept?.label || selectedDepartments[0];
            }
            return `Выбрано: ${selectedDepartments.length}`;
          };

          return (
            <div className="space-y-2">
              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border border-border-light',
                  'bg-surface-secondary px-3 py-2 text-sm text-text-primary',
                  'hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-ring-primary',
                  'transition-colors',
                )}
              >
                <span className={selectedDepartments.length === 0 ? 'text-text-secondary italic' : ''}>
                  {getDisplayText()}
                </span>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-text-secondary" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-text-secondary" />
                )}
              </button>

              {/* Dropdown Content */}
              {isOpen && (
                <div className="rounded-lg border border-border-light bg-surface-primary p-3 shadow-lg">
                  <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border-light">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={selectAll}
                      id="select-all-departments"
                      className="size-4"
                    />
                    <label
                      htmlFor="select-all-departments"
                      className="text-sm font-medium cursor-pointer select-none"
                    >
                      {isAllSelected ? 'Снять выбор со всех' : 'Выбрать все отделы'}
                    </label>
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {DEPARTMENTS.map((dept) => (
                      <div
                        key={dept.value}
                        className="flex items-center gap-2 hover:bg-surface-hover rounded p-1.5 transition-colors"
                      >
                        <Checkbox
                          checked={selectedDepartments.includes(dept.value)}
                          onCheckedChange={() => toggleDepartment(dept.value)}
                          id={`dept-${dept.value}`}
                          className="size-4"
                        />
                        <label
                          htmlFor={`dept-${dept.value}`}
                          className="text-sm cursor-pointer select-none text-text-primary flex-1"
                        >
                          {dept.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-text-secondary italic mt-2 pt-2 border-t border-border-light">
                    {selectedDepartments.length === 0 ? (
                      <span className="text-red-500">⚠️ Выберите хотя бы один отдел (обязательно)</span>
                    ) : selectedDepartments.length === DEPARTMENTS.length ? (
                      '✅ Агент будет доступен всем отделам'
                    ) : (
                      `✅ Агент будет доступен выбранным отделам (${selectedDepartments.length})`
                    )}
                  </p>
                </div>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
