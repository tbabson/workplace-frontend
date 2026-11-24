import { api } from './client';
import type { Department } from '../types';

export const departmentsApi = {
  list: () => api.get<{ data: Department[]; count: number }>('/departments/'),
  get: (id: string) => api.get<{ data: Department }>(`/departments/${id}`),
  create: (data: Partial<Department>) =>
    api.post<{ data: Department }>('/departments/', data),
  update: (id: string, data: Partial<Department>) =>
    api.put<{ data: Department }>(`/departments/${id}`, data),
  delete: (id: string) => api.delete(`/departments/${id}`),
};
