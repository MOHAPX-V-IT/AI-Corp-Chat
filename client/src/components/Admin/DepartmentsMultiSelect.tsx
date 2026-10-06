import React, { useState } from 'react';
import { Checkbox } from '@librechat/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DEPARTMENT_FULL_LABELS, type Departments } from '~/data-provider/Admin';
import { cn } from '~/utils';

const ALL_DEPARTMENTS: Departments = ['MP', 'RM', 'RGR', 'ROP', 'HR', 'PRODUCTION'];

interface DepartmentsMultiSelectProps {
  value: Departments;
  onChange: (departments: Departments) => void;
  className?: string;
}

export default function DepartmentsMultiSelect({ value, onChange, className }: DepartmentsMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDepartment = (dept: string) => {
    const newDepartments = value.includes(dept)
      ? value.filter((d) => d !== dept)
      : [...value, dept];
    onChange(newDepartments);
  };

  const selectAll = () => {
    if (value.length === ALL_DEPARTMENTS.length) {
      onChange([]);
    } else {
      onChange([...ALL_DEPARTMENTS]);
    }
  };

  const isAllSelected = value.length === ALL_DEPARTMENTS.length;

  const getDisplayText = () => {
    if (value.length === 0) {
      return 'Не выбрано';
    }
    if (value.length === ALL_DEPARTMENTS.length) {
      return 'Все отделы';
    }
    if (value.length === 1) {
      return DEPARTMENT_FULL_LABELS[value[0]] || value[0];
    }
    return `Выбрано: ${value.length}`;
  };

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border border-border-medium',
          'bg-surface-secondary px-3 py-2.5 text-sm text-text-primary',
          'hover:bg-surface-hover focus:border-green-500 focus:outline-none',
          'transition-colors',
        )}
      >
        <span className={value.length === 0 ? 'text-text-secondary' : ''}>
          {getDisplayText()}
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-text-secondary ml-2" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-secondary ml-2" />
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-medium bg-surface-primary p-2 shadow-lg">
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border-light">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={selectAll}
              id="select-all-depts"
              className="size-4"
            />
            <label
              htmlFor="select-all-depts"
              className="text-sm font-medium cursor-pointer select-none"
            >
              {isAllSelected ? 'Снять всё' : 'Выбрать все'}
            </label>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {ALL_DEPARTMENTS.map((dept) => (
              <div
                key={dept}
                className="flex items-center gap-2 hover:bg-surface-hover rounded p-1.5 transition-colors"
              >
                <Checkbox
                  checked={value.includes(dept)}
                  onCheckedChange={() => toggleDepartment(dept)}
                  id={`dept-admin-${dept}`}
                  className="size-4"
                />
                <label
                  htmlFor={`dept-admin-${dept}`}
                  className="text-sm cursor-pointer select-none text-text-primary flex-1"
                >
                  {DEPARTMENT_FULL_LABELS[dept]}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
