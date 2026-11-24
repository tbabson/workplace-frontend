import { api } from './client';
import type { ChatRoom, ChatMessage, MessageReaction } from '../types';

export const chatApi = {
  listRooms: () => api.get<{ data: ChatRoom[]; count: number }>('/chat/rooms'),
  createRoom: (data: { name: string; type: string; department_id?: string }) =>
    api.post<{ data: ChatRoom }>('/chat/rooms', data),
  deleteRoom: (roomId: string) => api.delete(`/chat/rooms/${roomId}`),
  createDM: (userId: string) =>
    api.post<{ data: ChatRoom }>('/chat/dm', { user_id: userId }),
  getMessages: (roomId: string) =>
    api.get<{ data: ChatMessage[]; count: number }>(`/chat/rooms/${roomId}/messages`),
  deleteMessage: (msgId: string) => api.delete(`/chat/messages/${msgId}`),
  addReaction: (msgId: string, emoji: string) =>
    api.post(`/chat/messages/${msgId}/reactions`, { emoji }),
  removeReaction: (msgId: string, emoji: string) =>
    api.delete(`/chat/messages/${msgId}/reactions/${emoji}`),
  getReactions: (msgId: string) =>
    api.get<{ data: MessageReaction[] }>(`/chat/messages/${msgId}/reactions`),
  markRead: (roomId: string) => api.post(`/chat/rooms/${roomId}/read`, {}),
  addMember: (roomId: string, userId: string) =>
    api.post(`/chat/rooms/${roomId}/members`, { user_id: userId }),
  removeMember: (roomId: string, userId: string) =>
    api.delete(`/chat/rooms/${roomId}/members/${userId}`),
};
