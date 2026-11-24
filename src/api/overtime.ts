import { api } from './client';
import type { Overtime } from '../types';

export const overtimeApi = {
  list: () => api.get<{ data: Overtime[]; count: number }>('/overtime/'),
  get: (id: string) => api.get<{ data: Overtime }>(`/overtime/${id}`),
  create: (data: { user_id: string; start_time: string; end_time?: string; hourly_rate: number; notes?: string; project_id?: string }) =>
    api.post<{ data: Overtime }>('/overtime/', data),
  update: (id: string, data: Partial<Overtime>) =>
    api.put<{ data: Overtime }>(`/overtime/${id}`, data),
  markPaid: (id: string) => api.put(`/overtime/${id}/mark-paid`, {}),
  delete: (id: string) => api.delete(`/overtime/${id}`),
};
