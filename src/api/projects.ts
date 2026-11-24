import { api } from './client';
import type { Project, Task, Milestone, ProjectComment, BudgetSummary, ProjectFile } from '../types';

export const projectsApi = {
  list: () => api.get<{ data: Project[]; count: number }>('/projects/'),
  get: (id: string) => api.get<{ data: Project }>(`/projects/${id}`),
  create: (data: Partial<Project>) => api.post<{ data: Project }>('/projects/', data),
  update: (id: string, data: Partial<Project>) =>
    api.put<{ data: Project }>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  updateProgress: (id: string, progress: number) =>
    api.put(`/projects/${id}/progress`, { progress }),
  assign: (id: string, userId: string) =>
    api.post(`/projects/${id}/assign`, { user_id: userId }),
  unassign: (id: string, userId: string) =>
    api.delete(`/projects/${id}/assign/${userId}`),
  getAssignees: (id: string) =>
    api.get<{ data: string[] }>(`/projects/${id}/assignees`),
  getBudget: (id: string) =>
    api.get<{ data: BudgetSummary }>(`/projects/${id}/budget`),
  setBudget: (id: string, budget: number) =>
    api.put(`/projects/${id}/budget`, { budget }),
  addExpense: (id: string, data: { description: string; amount: number; date: string }) =>
    api.post(`/projects/${id}/expenses`, data),
  deleteExpense: (id: string, expenseId: string) =>
    api.delete(`/projects/${id}/expenses/${expenseId}`),
  getFiles: (id: string) =>
    api.get<{ data: ProjectFile[] }>(`/projects/${id}/files`),
  addFile: (id: string, data: { name: string; url: string }) =>
    api.post(`/projects/${id}/files`, data),
  deleteFile: (id: string, fileId: string) =>
    api.delete(`/projects/${id}/files/${fileId}`),

  // Tasks
  listTasks: (projectId: string) =>
    api.get<{ data: Task[]; count: number }>(`/projects/${projectId}/tasks`),
  createTask: (projectId: string, data: Partial<Task>) =>
    api.post<{ data: Task }>(`/projects/${projectId}/tasks`, data),
  getTask: (id: string) => api.get<{ data: Task }>(`/tasks/${id}`),
  updateTask: (id: string, data: Partial<Task>) =>
    api.put<{ data: Task }>(`/tasks/${id}`, data),
  deleteTask: (id: string) => api.delete(`/tasks/${id}`),

  // Milestones
  listMilestones: (projectId: string) =>
    api.get<{ data: Milestone[]; count: number }>(`/projects/${projectId}/milestones`),
  createMilestone: (projectId: string, data: Partial<Milestone>) =>
    api.post<{ data: Milestone }>(`/projects/${projectId}/milestones`, data),
  updateMilestone: (id: string, data: Partial<Milestone>) =>
    api.put<{ data: Milestone }>(`/milestones/${id}`, data),
  achieveMilestone: (id: string) => api.put(`/milestones/${id}/achieve`, {}),
  deleteMilestone: (id: string) => api.delete(`/milestones/${id}`),

  // Comments
  listComments: (projectId: string) =>
    api.get<{ data: ProjectComment[]; count: number }>(`/projects/${projectId}/comments`),
  createComment: (projectId: string, data: { content: string; parent_id?: string }) =>
    api.post<{ data: ProjectComment }>(`/projects/${projectId}/comments`, data),
  updateComment: (id: string, data: { content: string }) =>
    api.put<{ data: ProjectComment }>(`/comments/${id}`, data),
  deleteComment: (id: string) => api.delete(`/comments/${id}`),
};
