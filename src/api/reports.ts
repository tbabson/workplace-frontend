import { api } from './client';
import type { DashboardStats } from '../types';

export interface AttendanceRow {
  id: string;
  user_id: string;
  user_name: string;
  date: string;
  sign_in_at: string | null;
  sign_out_at: string | null;
  hours_worked: number;
}

export interface OvertimeRow {
  user_id: string;
  user_name: string;
  date: string;
  overtime_hours: number;
}

export const reportsApi = {
  dashboard: () => api.get<{ data: DashboardStats }>('/reports/dashboard'),
  attendance: (from: string, to: string) =>
    api.get<{ data: AttendanceRow[]; count: number }>('/reports/attendance', { params: { from, to } }),
  attendanceExport: (from: string, to: string) =>
    api.get('/reports/attendance/export', {
      params: { from, to },
      responseType: 'blob',
    }),
  overtime: (from?: string, to?: string) =>
    api.get<{ data: OvertimeRow[]; count: number }>('/reports/overtime', { params: { from, to } }),
  overtimeExport: (from?: string, to?: string) =>
    api.get('/reports/overtime/export', { params: { from, to }, responseType: 'blob' }),
};
