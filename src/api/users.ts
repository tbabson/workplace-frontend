import { api } from './client';
import type { User } from '../types';

export const usersApi = {
  list: () => api.get<{ data: User[]; count: number }>('/users/'),
  get: (id: string) => api.get<{ data: User }>(`/users/${id}`),
  // super_admin only
  create: (data: Partial<User> & { password: string }) =>
    api.post<{ data: User }>('/users/', data),
  // super_admin may change anything; other users only their own name/email/position
  update: (id: string, data: { name?: string; email?: string; role?: User['role']; position?: string | null; department_id?: string | null; department_name?: string | null; is_active?: boolean }) =>
    api.put<{ data: User }>(`/users/${id}`, data),
  updateMe: (data: { name?: string; email?: string; position?: string }) =>
    api.put<{ data: User }>('/users/me', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/users/me/password', { current_password: currentPassword, new_password: newPassword }),
  // super_admin only
  delete: (id: string) => api.delete(`/users/${id}`),
};
