import { api } from './client';
import type { LeaveRequest, LeaveBalance } from '../types';

export const leavesApi = {
  list: () => api.get<{ data: LeaveRequest[]; count: number }>('/leaves/'),
  get: (id: string) => api.get<{ data: LeaveRequest }>(`/leaves/${id}`),
  create: (data: Partial<LeaveRequest>) =>
    api.post<{ data: LeaveRequest }>('/leaves/', data),
  approve: (id: string, note?: string) =>
    api.put(`/leaves/${id}/approve`, { note }),
  reject: (id: string, note?: string) =>
    api.put(`/leaves/${id}/reject`, { note }),
  cancel: (id: string) => api.put(`/leaves/${id}/cancel`, {}),
  getBalance: (userId: string, year?: number) =>
    api.get<{ data: LeaveBalance[] }>(`/leaves/balance/${userId}`, {
      params: year ? { year } : {},
    }),
  setBalance: (userId: string, data: Partial<LeaveBalance>) =>
    api.post(`/leaves/balance/${userId}`, data),
};
