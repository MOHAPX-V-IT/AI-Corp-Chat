import React, { useState } from 'react';
import { SystemRoles } from 'librechat-data-provider';
import { Spinner } from '@librechat/client';
import {
  useGetAdminUsers,
  useCreateUserMutation,
  useAdminDeleteUserMutation,
  useUpdateUserRoleMutation,
  useUpdateUserDepartmentsMutation,
  useUpdateUserProfileMutation,
  useBanUserMutation,
  useAddUserBalanceMutation,
  AdminUser,
  Departments,
  DEPARTMENT_LABELS,
} from '~/data-provider/Admin';
import DepartmentsMultiSelect from './DepartmentsMultiSelect';
import { cn } from '~/utils';

function CreateUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(SystemRoles.USER);
  const [departments, setDepartments] = useState<Departments>([]);

  const createMutation = useCreateUserMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({ email, password, name, role, departments });
      onClose();
      setEmail('');
      setPassword('');
      setName('');
      setRole(SystemRoles.USER);
      setDepartments([]);
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-surface-primary p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Создать пользователя</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5 text-text-primary focus:border-green-500 focus:outline-none"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Пароль *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5 text-text-primary focus:border-green-500 focus:outline-none"
              placeholder="Минимум 8 символов"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Имя</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5 text-text-primary focus:border-green-500 focus:outline-none"
              placeholder="Иван Иванов"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">Админ-роль</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5 text-text-primary focus:border-green-500 focus:outline-none"
              >
                <option value={SystemRoles.USER}>Пользователь</option>
                <option value={SystemRoles.ADMIN}>Администратор</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">Отделы</label>
              <DepartmentsMultiSelect value={departments} onChange={setDepartments} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-hover"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({
  user,
  isOpen,
  onClose
}: {
  user: AdminUser;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name || '');
  const [password, setPassword] = useState('');

  const updateMutation = useUpdateUserProfileMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updates: any = { userId: user._id };

      // Only include changed fields
      if (email !== user.email) {
        updates.email = email;
      }
      if (name !== (user.name || '')) {
        updates.name = name;
      }
      if (password.trim()) {
        updates.password = password;
      }

      // Check if there are any updates
      if (Object.keys(updates).length === 1) {
        alert('Нет изменений');
        return;
      }

      await updateMutation.mutateAsync(updates);
      onClose();
      // Reset password field
      setPassword('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при обновлении пользователя');
    }
  };

  // Reset form when modal opens with new user
  React.useEffect(() => {
    if (isOpen) {
      setEmail(user.email);
      setName(user.name || '');
      setPassword('');
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-surface-primary p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Редактировать пользователя
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5 text-text-primary focus:border-green-500 focus:outline-none"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Имя
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5 text-text-primary focus:border-green-500 focus:outline-none"
              placeholder="Иван Иванов"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Новый пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              className="w-full rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5 text-text-primary focus:border-green-500 focus:outline-none"
              placeholder="Оставьте пустым, если не меняете"
            />
            {password && password.length < 8 && (
              <p className="mt-1 text-xs text-red-500">Минимум 8 символов</p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border-medium px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserActionsMenu({
  user,
  onClose,
  onEditClick,
}: {
  user: AdminUser;
  onClose: () => void;
  onEditClick: () => void;
}) {
  const deleteMutation = useAdminDeleteUserMutation();
  const roleMutation = useUpdateUserRoleMutation();
  const departmentsMutation = useUpdateUserDepartmentsMutation();
  const banMutation = useBanUserMutation();
  const balanceMutation = useAddUserBalanceMutation();

  const [showBalanceInput, setShowBalanceInput] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [showDepartmentSelect, setShowDepartmentSelect] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<Departments>(user.departments || []);

  const handleDelete = async () => {
    if (confirm(`Удалить пользователя ${user.email}?`)) {
      await deleteMutation.mutateAsync(user._id);
      onClose();
    }
  };

  const handleToggleRole = async () => {
    const newRole = user.role === SystemRoles.ADMIN ? SystemRoles.USER : SystemRoles.ADMIN;
    await roleMutation.mutateAsync({ userId: user._id, role: newRole });
    onClose();
  };

  const handleToggleBan = async () => {
    const reason = user.banned ? undefined : prompt('Причина бана:');
    await banMutation.mutateAsync({ userId: user._id, banned: !user.banned, reason: reason || undefined });
    onClose();
  };

  const handleAddBalance = async () => {
    const amount = parseInt(balanceAmount);
    if (isNaN(amount)) return;
    await balanceMutation.mutateAsync({ userId: user._id, amount });
    setBalanceAmount('');
    setShowBalanceInput(false);
    onClose();
  };

  const handleDepartmentsChange = async () => {
    await departmentsMutation.mutateAsync({ userId: user._id, departments: selectedDepartments });
    setShowDepartmentSelect(false);
    onClose();
  };

  return (
    <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-border-medium bg-surface-primary py-2 shadow-xl">
      <div className="px-3 py-2 text-xs font-medium uppercase text-text-tertiary">Действия</div>

      <button
        onClick={() => {
          onEditClick();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
      >
        <span>✏️</span>
        <span>Редактировать профиль</span>
      </button>

      <button
        onClick={handleToggleRole}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
      >
        <span>{user.role === SystemRoles.ADMIN ? '👤' : '👑'}</span>
        <span>{user.role === SystemRoles.ADMIN ? 'Убрать админа' : 'Сделать админом'}</span>
      </button>

      {!showDepartmentSelect ? (
        <button
          onClick={() => setShowDepartmentSelect(true)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
        >
          <span>🏢</span>
          <span>Изменить отделы</span>
        </button>
      ) : (
        <div className="px-3 py-2 space-y-2">
          <DepartmentsMultiSelect value={selectedDepartments} onChange={setSelectedDepartments} />
          <div className="flex gap-2">
            <button
              onClick={handleDepartmentsChange}
              className="flex-1 rounded bg-green-600 px-2 py-1.5 text-xs text-white hover:bg-green-700"
            >
              Сохранить
            </button>
            <button
              onClick={() => setShowDepartmentSelect(false)}
              className="flex-1 rounded bg-surface-secondary px-2 py-1.5 text-xs hover:bg-surface-hover"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <button
        onClick={handleToggleBan}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover',
          user.banned ? 'text-green-500' : 'text-yellow-500',
        )}
      >
        <span>{user.banned ? '✅' : '🚫'}</span>
        <span>{user.banned ? 'Разбанить' : 'Забанить'}</span>
      </button>

      {!showBalanceInput ? (
        <button
          onClick={() => setShowBalanceInput(true)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
        >
          <span>💰</span>
          <span>Добавить токены</span>
        </button>
      ) : (
        <div className="px-3 py-2">
          <div className="flex gap-2">
            <input
              type="number"
              value={balanceAmount}
              onChange={(e) => setBalanceAmount(e.target.value)}
              placeholder="±1000"
              className="w-full rounded border border-border-medium bg-surface-secondary px-2 py-1.5 text-sm"
              autoFocus
            />
            <button
              onClick={handleAddBalance}
              className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <hr className="my-2 border-border-light" />

      <button
        onClick={handleDelete}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10"
      >
        <span>🗑️</span>
        <span>Удалить</span>
      </button>
    </div>
  );
}

export default function UsersList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);

  const { data, isLoading, error, refetch } = useGetAdminUsers({ page, limit: 20, search });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="mt-2 text-red-500">Ошибка загрузки пользователей</p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск по email, имени..."
            className="w-64 rounded-lg border border-border-medium bg-surface-secondary px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:border-green-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-surface-tertiary px-4 py-2.5 text-text-primary hover:bg-surface-hover"
          >
            🔍
          </button>
        </form>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
        >
          <span>+</span>
          <span>Создать пользователя</span>
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Spinner className="mx-auto h-10 w-10" />
            <p className="mt-4 text-text-secondary">Загрузка пользователей...</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-medium">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium text-text-secondary">
                    Пользователь
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium text-text-secondary">
                    Админ-роль
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium text-text-secondary">
                    Отдел
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium text-text-secondary">
                    Статус
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-text-secondary">
                    Баланс
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium text-text-secondary">
                    Создан
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-text-secondary">

                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {data?.users.map((user) => (
                  <tr key={user._id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-text-primary">
                        {user.name || user.email}
                      </div>
                      {user.name && <div className="text-xs text-text-tertiary">{user.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                          user.role === SystemRoles.ADMIN
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-gray-500/20 text-gray-400',
                        )}
                      >
                        {user.role === SystemRoles.ADMIN ? '👑 Админ' : '👤 Пользователь'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.departments && user.departments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.departments.map((dept) => (
                            <span
                              key={dept}
                              className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400"
                            >
                              {DEPARTMENT_LABELS[dept]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.banned ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500">
                          <span>🚫</span> Забанен
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-green-500">
                          <span>✅</span> Активен
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm text-text-primary">
                        {(user.balance || 0).toLocaleString('ru-RU')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-tertiary">
                      {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="relative px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          setActiveMenuUserId(activeMenuUserId === user._id ? null : user._id)
                        }
                        className="rounded-lg p-2 text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary"
                      >
                        ⋮
                      </button>
                      {activeMenuUserId === user._id && (
                        <UserActionsMenu
                          user={user}
                          onClose={() => setActiveMenuUserId(null)}
                          onEditClick={() => setEditUser(user)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between rounded-xl bg-surface-secondary px-4 py-3">
          <div className="text-sm text-text-tertiary">
            Страница {data.pagination.page} из {data.pagination.pages} (всего: {data.pagination.total})
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg px-4 py-2 text-sm hover:bg-surface-hover disabled:opacity-50"
            >
              ← Назад
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
              disabled={page === data.pagination.pages}
              className="rounded-lg px-4 py-2 text-sm hover:bg-surface-hover disabled:opacity-50"
            >
              Вперёд →
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <CreateUserModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

      {/* Edit Modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          isOpen={!!editUser}
          onClose={() => setEditUser(null)}
        />
      )}
    </div>
  );
}
