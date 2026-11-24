import { api } from './client';
import type { Asset } from '../types';

export const assetsApi = {
  list: () => api.get<{ data: Asset[]; count: number }>('/assets/'),
  get: (id: string) => api.get<{ data: Asset }>(`/assets/${id}`),
  create: (data: Partial<Asset>) => api.post<{ data: Asset }>('/assets/', data),
  update: (id: string, data: Partial<Asset>) =>
    api.put<{ data: Asset }>(`/assets/${id}`, data),
  assign: (id: string, userId: string) =>
    api.post(`/assets/${id}/assign`, { user_id: userId }),
  unassign: (id: string) => api.post(`/assets/${id}/unassign`, {}),
  delete: (id: string) => api.delete(`/assets/${id}`),
};
