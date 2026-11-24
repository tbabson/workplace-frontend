import { api } from './client';
import type { Attendance } from '../types';

function getDeviceID(): string {
  const key = 'wp_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export const attendanceApi = {
  signIn: (lat: number, lng: number) =>
    api.post<{ data: Attendance }>('/attendance/sign-in', {
      latitude: lat,
      longitude: lng,
      device_id: getDeviceID(),
    }),
  signOut: () => api.post<{ data: Attendance }>('/attendance/sign-out'),
  adminSignOut: (id: string, signOutAt?: string) =>
    api.put<{ data: Attendance }>(`/attendance/${id}/sign-out`, signOutAt ? { sign_out_at: signOutAt } : {}),
  me: () => api.get<{ data: Attendance[]; count: number }>('/attendance/me'),
  byUser: (userId: string) =>
    api.get<{ data: Attendance[]; count: number }>(`/attendance/user/${userId}`),
  list: () => api.get<{ data: Attendance[]; count: number }>('/attendance/'),
};
