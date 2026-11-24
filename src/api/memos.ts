import { api } from './client';
import type { Memo, Acknowledgement } from '../types';

export const memosApi = {
  list: () => api.get<{ data: Memo[]; count: number }>('/memos/'),
  get: (id: string) => api.get<{ data: Memo }>(`/memos/${id}`),
  create: (data: Partial<Memo>) => api.post<{ data: Memo }>('/memos/', data),
  markRead: (id: string) => api.put(`/memos/${id}/read`, {}),
  acknowledge: (id: string) => api.post(`/memos/${id}/acknowledge`, {}),
  getAcknowledgements: (id: string) => api.get<{ data: Acknowledgement[] }>(`/memos/${id}/acknowledgements`),
  delete: (id: string) => api.delete(`/memos/${id}`),
};
