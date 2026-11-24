import { api } from './client';
import type { User } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ message: string; token: string }>('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<{ data: User }>('/users/me'),
};
