import { api } from './client';
import type { Notification } from '../types';

export const notificationsApi = {
  list: () => api.get<{ data: Notification[]; count: number }>('/notifications/'),
  unreadCount: () =>
    api.get<{ data: { unread: number } }>('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`, {}),
  markAllRead: () => api.put('/notifications/read-all', {}),
  clearAll: () => api.delete('/notifications/clear-all'),
};
