import React, { useState } from 'react';
import { useGetAdminStats } from '~/data-provider/Admin';
import { Spinner } from '@librechat/client';
import { cn } from '~/utils';

interface AccordionProps {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Accordion({ title, icon, defaultOpen = true, children }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-border-medium bg-surface-secondary">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface-hover"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        </div>
        <span
          className={cn(
            'text-text-tertiary transition-transform duration-200',
            isOpen ? 'rotate-180' : '',
          )}
        >
          ▼
        </span>
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="border-t border-border-light px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  trend,
  color = 'default',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'default' | 'green' | 'blue' | 'orange' | 'purple';
}) {
  const colorClasses = {
    default: 'bg-surface-tertiary',
    green: 'bg-green-500/10 border-green-500/20',
    blue: 'bg-blue-500/10 border-blue-500/20',
    orange: 'bg-orange-500/10 border-orange-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
  };

  const valueColorClasses = {
    default: 'text-text-primary',
    green: 'text-green-500',
    blue: 'text-blue-500',
    orange: 'text-orange-500',
    purple: 'text-purple-500',
  };

  const displayValue = typeof value === 'number' ? value.toLocaleString('ru-RU') : value;

  return (
    <div
      className={cn(
        'rounded-lg border border-border-light p-4 transition-all hover:shadow-sm',
        colorClasses[color],
      )}
    >
      <div className="text-sm text-text-secondary">{title}</div>
      <div className={cn('mt-1 text-2xl font-bold', valueColorClasses[color])}>
        {displayValue}
      </div>
      {subtitle && (
        <div className="mt-1 flex items-center gap-1 text-xs text-text-tertiary">
          {trend === 'up' && <span className="text-green-500">↑</span>}
          {trend === 'down' && <span className="text-red-500">↓</span>}
          {subtitle}
        </div>
      )}
    </div>
  );
}

export default function AdminStats() {
  const { data, isLoading, error, refetch } = useGetAdminStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Spinner className="mx-auto h-10 w-10" />
          <p className="mt-4 text-text-secondary">Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="mt-2 text-red-500">Ошибка загрузки статистики</p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Users Section */}
      <Accordion title="Пользователи" icon="👥" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard title="Всего" value={data.users?.total ?? 0} color="blue" />
          <StatCard title="Сегодня" value={data.users?.newToday ?? 0} subtitle="новых" trend="up" color="green" />
          <StatCard title="За неделю" value={data.users?.newWeek ?? 0} subtitle="новых" />
          <StatCard title="За месяц" value={data.users?.newMonth ?? 0} subtitle="новых" />
        </div>
      </Accordion>

      {/* Tokens Section */}
      <Accordion title="Расход токенов" icon="🪙" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            title="Общий расход"
            value={data.tokens?.rawAmountMonth ?? 0}
            subtitle="токенов за месяц"
            color="orange"
          />
          <StatCard
            title="Запросов"
            value={data.tokens?.requestsMonth ?? 0}
            subtitle="за месяц"
            color="purple"
          />
          <StatCard
            title="Баланс в системе"
            value={data.tokens?.totalCredits ?? 0}
            subtitle="токенов доступно"
            color="blue"
          />
        </div>
      </Accordion>

      {/* Activity Section */}
      <Accordion title="Активность" icon="📈" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard title="Всего диалогов" value={data.conversations?.total ?? 0} color="blue" />
          <StatCard title="Диалогов сегодня" value={data.conversations?.today ?? 0} color="green" />
          <StatCard title="Всего сообщений" value={data.messages?.total ?? 0} />
          <StatCard title="Сообщений сегодня" value={data.messages?.today ?? 0} />
        </div>
      </Accordion>

      {/* Usage by Model */}
      {data.tokensByModel && data.tokensByModel.length > 0 && (
        <Accordion title="Использование по моделям" icon="🤖" defaultOpen={false}>
          <div className="overflow-hidden rounded-lg border border-border-light">
            <table className="w-full">
              <thead className="bg-surface-tertiary">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Модель</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Токенов</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Запросов</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {data.tokensByModel.map((item) => (
                  <tr key={item._id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-text-primary">{item._id}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-text-primary">
                      {(item.totalTokens ?? 0).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-text-tertiary">
                      {(item.requestCount ?? 0).toLocaleString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Accordion>
      )}

      {/* Top Users */}
      {data.topUsers && data.topUsers.length > 0 && (
        <Accordion title="Топ пользователей (за месяц)" icon="🏆" defaultOpen={false}>
          <div className="overflow-hidden rounded-lg border border-border-light">
            <table className="w-full">
              <thead className="bg-surface-tertiary">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">#</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Пользователь</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Токенов</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Запросов</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {data.topUsers.map((item, index) => (
                  <tr key={item._id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                          index === 0 && 'bg-yellow-500/20 text-yellow-500',
                          index === 1 && 'bg-gray-400/20 text-gray-400',
                          index === 2 && 'bg-orange-500/20 text-orange-500',
                          index > 2 && 'text-text-tertiary',
                        )}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-text-primary">
                        {item.user?.name || item.user?.email || 'Unknown'}
                      </div>
                      {item.user?.name && (
                        <div className="text-xs text-text-tertiary">{item.user.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-text-primary">
                      {(item.totalTokens ?? 0).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-text-tertiary">
                      {(item.requestCount ?? 0).toLocaleString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Accordion>
      )}
    </div>
  );
}
