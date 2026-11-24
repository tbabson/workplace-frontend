import { api } from './client';
import type { Claim } from '../types';

export const claimsApi = {
  list: () => api.get<{ data: Claim[]; count: number }>('/claims/'),
  get: (id: string) => api.get<{ data: Claim }>(`/claims/${id}`),
  create: (data: Partial<Claim>) => api.post<{ data: Claim }>('/claims/', data),
  approve: (id: string) => api.post(`/claims/${id}/approve`, {}),
  reject: (id: string) => api.post(`/claims/${id}/reject`, {}),
  pay: (id: string) => api.post(`/claims/${id}/pay`, {}),
  delete: (id: string) => api.delete(`/claims/${id}`),
};
