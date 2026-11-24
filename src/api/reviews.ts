import { api } from './client';
import type { Review } from '../types';

export const reviewsApi = {
  list: () => api.get<{ data: Review[]; count: number }>('/reviews/'),
  get: (id: string) => api.get<{ data: Review }>(`/reviews/${id}`),
  create: (data: Partial<Review>) => api.post<{ data: Review }>('/reviews/', data),
  update: (id: string, data: Partial<Review>) =>
    api.put<{ data: Review }>(`/reviews/${id}`, data),
  delete: (id: string) => api.delete(`/reviews/${id}`),
};
