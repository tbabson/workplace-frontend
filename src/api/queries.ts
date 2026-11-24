import { api } from './client';
import type { Query } from '../types';

export const queriesApi = {
  list: () => api.get<{ data: Query[]; count: number }>('/queries/'),
  get: (id: string) => api.get<{ data: Query }>(`/queries/${id}`),
  create: (data: Partial<Query>) => api.post<{ data: Query }>('/queries/', data),
  respond: (id: string, response: string) =>
    api.put(`/queries/${id}/respond`, { response }),
  delete: (id: string) => api.delete(`/queries/${id}`),
};
