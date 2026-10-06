import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const AdminQueryKeys = {
  adminUsers: 'adminUsers',
  adminStats: 'adminStats',
  userTransactions: 'userTransactions',
  departments: 'departments',
};

// Department types
export type Department = 'MP' | 'RM' | 'RGR' | 'ROP' | 'HR' | 'PRODUCTION';
export type Departments = Department[];

export const DEPARTMENT_LABELS: Record<string, string> = {
  MP: 'МП',
  RM: 'РМ',
  RGR: 'РГР',
  ROP: 'РОП',
  HR: 'HR',
  PRODUCTION: 'Производство',
};

export const DEPARTMENT_FULL_LABELS: Record<string, string> = {
  MP: 'Медицинский представитель',
  RM: 'Региональный менеджер',
  RGR: 'Руководитель группы регионов',
  ROP: 'Руководитель продаж',
  HR: 'HR менеджер',
  PRODUCTION: 'Отдел производства',
};

// Types
export interface AdminUser {
  _id: string;
  email: string;
  name?: string;
  username?: string;
  role: string;
  departments?: Departments;
  banned?: boolean;
  banReason?: string;
  bannedAt?: string;
  emailVerified?: boolean;
  provider?: string;
  balance?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AdminStats {
  users: {
    total: number;
    newToday: number;
    newWeek: number;
    newMonth: number;
  };
  tokens: {
    totalCredits: number;
    rawAmountMonth: number;
    requestsMonth: number;
  };
  conversations: {
    total: number;
    today: number;
    week: number;
  };
  messages: {
    total: number;
    today: number;
  };
  topUsers: Array<{
    _id: string;
    totalTokens: number;
    requestCount: number;
    user: {
      name?: string;
      email: string;
    };
  }>;
  tokensByModel: Array<{
    _id: string;
    totalTokens: number;
    requestCount: number;
  }>;
  departments: Record<string, string>;
}

export interface CreateUserData {
  email: string;
  password: string;
  name?: string;
  role?: string;
  departments?: Departments;
}

export interface UpdateUserProfileData {
  userId: string;
  email?: string;
  name?: string;
  password?: string;
}

// API functions
const getAdminUsers = async (params: { page?: number; limit?: number; search?: string }) => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.search) searchParams.set('search', params.search);

  const response = await axios.get(`/api/admin/users?${searchParams.toString()}`);
  return response.data as AdminUsersResponse;
};

const getAdminStats = async () => {
  const response = await axios.get('/api/admin/stats');
  return response.data as AdminStats;
};

const getDepartments = async () => {
  const response = await axios.get('/api/admin/departments');
  return response.data as { departments: string[]; labels: Record<string, string> };
};

const createUser = async (data: CreateUserData) => {
  const response = await axios.post('/api/admin/users', data);
  return response.data;
};

const deleteUser = async (userId: string) => {
  const response = await axios.delete(`/api/admin/users/${userId}`);
  return response.data;
};

const updateUserRole = async ({ userId, role }: { userId: string; role: string }) => {
  const response = await axios.put(`/api/admin/users/${userId}/role`, { role });
  return response.data;
};

const updateUserDepartments = async ({ userId, departments }: { userId: string; departments: Departments }) => {
  const response = await axios.put(`/api/admin/users/${userId}/departments`, { departments });
  return response.data;
};

const banUser = async ({ userId, banned, reason }: { userId: string; banned: boolean; reason?: string }) => {
  const response = await axios.post(`/api/admin/users/${userId}/ban`, { banned, reason });
  return response.data;
};

const addUserBalance = async ({ userId, amount }: { userId: string; amount: number }) => {
  const response = await axios.post(`/api/admin/users/${userId}/balance`, { amount });
  return response.data;
};

const updateUserProfile = async (data: UpdateUserProfileData) => {
  const { userId, ...profileData } = data;
  const response = await axios.put(`/api/admin/users/${userId}/profile`, profileData);
  return response.data;
};

// Hooks
export const useGetAdminUsers = (params: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: [AdminQueryKeys.adminUsers, params],
    queryFn: () => getAdminUsers(params),
  });
};

export const useGetAdminStats = () => {
  return useQuery({
    queryKey: [AdminQueryKeys.adminStats],
    queryFn: getAdminStats,
  });
};

export const useGetDepartments = () => {
  return useQuery({
    queryKey: [AdminQueryKeys.departments],
    queryFn: getDepartments,
  });
};

export const useCreateUserMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AdminQueryKeys.adminUsers] });
      queryClient.invalidateQueries({ queryKey: [AdminQueryKeys.adminStats] });
    },
  });
};

export const useAdminDeleteUserMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AdminQueryKeys.adminUsers] });
      queryClient.invalidateQueries({ queryKey: [AdminQueryKeys.adminStats] });
    },
  });
};

export const useUpdateUserRoleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AdminQueryKeys.adminUsers] });
    },
  });
};

export const useUpdateUserDepartmentsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserDepartments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AdminQueryKeys.adminUsers] });
    },
  });
};

export const useBanUserMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: banUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AdminQueryKeys.adminUsers] });
    },
  });
};

export const useAddUserBalanceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addUserBalance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AdminQueryKeys.adminUsers] });
    },
  });
};

export const useUpdateUserProfileMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AdminQueryKeys.adminUsers] });
      queryClient.invalidateQueries({ queryKey: [AdminQueryKeys.adminStats] });
    },
  });
};
