import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks';
import { SystemRoles } from 'librechat-data-provider';
import AdminStats from './AdminStats';
import UsersList from './UsersList';
import { cn } from '~/utils';

type Tab = 'stats' | 'users';

export default function AdminPanel() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('stats');

  // Check if user is admin
  if (user?.role !== SystemRoles.ADMIN) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-primary">
        <div className="text-center">
          <div className="mb-4 text-6xl">🔒</div>
          <h1 className="text-2xl font-bold text-red-500">Доступ запрещён</h1>
          <p className="mt-2 text-text-secondary">У вас нет прав для просмотра этой страницы</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 rounded-lg bg-green-600 px-6 py-2 text-white transition-colors hover:bg-green-700"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'stats' as Tab, label: 'Статистика', icon: '📊' },
    { id: 'users' as Tab, label: 'Пользователи', icon: '👥' },
  ];

  return (
    <div className="flex h-screen flex-col bg-surface-primary">
      {/* Header */}
      <header className="border-b border-border-medium bg-surface-secondary px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 text-xl">
              ⚙️
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Админ-панель</h1>
              <p className="text-sm text-text-tertiary">Управление платформой AI Corp Chat</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-lg border border-border-medium px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
          >
            <span>←</span>
            <span>Назад к чату</span>
          </button>
        </div>

        {/* Tabs */}
        <nav className="mt-6 flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-6">
          {activeTab === 'stats' && <AdminStats />}
          {activeTab === 'users' && <UsersList />}
        </div>
      </main>
    </div>
  );
}
