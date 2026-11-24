import { useState, useEffect, useRef } from "react";
import { Bell, Check, Menu } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { notificationsApi } from "../../api/notifications";
import { WS_URL } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import type { Notification, NotificationType } from "../../types";
import { timeAgo } from "../../utils/helpers";
import "../../utils/sound"; // registers global workplace:notification listener
import toast from "react-hot-toast";

function getNotificationRoute(type: NotificationType, refId: string | null): string {
  switch (type) {
    case 'chat_message':       return '/chat';
    case 'project_assigned':
    case 'project_unassigned':
    case 'project_progress':
    case 'project_status':
    case 'project_comment':
    case 'budget_updated':
    case 'project_created':
    case 'project_due_reminder': return refId ? `/projects/${refId}` : '/projects';
    // Task notifications reference the task, not its project.
    case 'task_assigned':
    case 'task_updated':
    case 'task_due_reminder':  return '/projects';
    case 'overtime_created':
    case 'overtime_paid':      return '/overtime';
    case 'memo_received':      return '/memos';
    case 'query_issued':
    case 'query_responded':    return '/queries';
    case 'leave_approved':
    case 'leave_rejected':     return '/leaves';
    case 'claim_approved':
    case 'claim_rejected':
    case 'claim_paid':         return '/claims';
    case 'asset_assigned':     return '/assets';
    case 'attendance_sign_in':
    case 'attendance_sign_out':
    case 'attendance_auto_closed':
    case 'sign_out_reminder':  return '/attendance';
    default:                   return '/';
  }
}

export function Topbar({ title, onMenuClick }: { title?: string; onMenuClick?: () => void }) {
  const { isAuthenticated, token } = useAuthStore();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => notificationsApi.unreadCount().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list().then((r) => r.data.data),
    enabled: open,
  });

  const markAllMut = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const markOneMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const clearAllMut = useMutation({
    mutationFn: notificationsApi.clearAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  // WebSocket for real-time notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let unmounted = false;

    function connect() {
      const url = token ? `${WS_URL}/notifications/ws?token=${token}` : `${WS_URL}/notifications/ws`;
      ws = new WebSocket(url);
      ws.onmessage = (e) => {
        queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
        if (openRef.current) queryClient.invalidateQueries({ queryKey: ["notifications"] });
        try {
          const n = JSON.parse(e.data) as Notification;
          if (n?.title) {
            toast(n.title, { duration: 4000 });
            window.dispatchEvent(new Event('workplace:notification'));
          }
          if (n?.type === "attendance_sign_in" || n?.type === "attendance_sign_out") {
            window.dispatchEvent(new Event("workplace:attendance"));
          }
        } catch { /* ignore malformed frames */ }
      };
      ws.onclose = () => {
        if (!unmounted) reconnectTimer = setTimeout(connect, 5000);
      };
      ws.onerror = () => {};
    }

    connect();
    return () => {
      unmounted = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [isAuthenticated, token, queryClient]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = countData?.unread ?? 0;
  const notifications: Notification[] = notifData ?? [];

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 z-30 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      </div>

      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setOpen(!open)}
          className="relative p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-sm text-gray-900">Notifications</span>
              {unread > 0 && (
                <button
                  onClick={() => markAllMut.mutate()}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Check size={12} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No notifications
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.is_read) markOneMut.mutate(n.id);
                      setOpen(false);
                      navigate(getNotificationRoute(n.type, n.ref_id));
                    }}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !n.is_read ? "bg-indigo-50/40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {!n.is_read && (
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                      )}
                      <div className={!n.is_read ? "" : "pl-5"}>
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">{n.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.body}</p>
                        <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-100">
                <button
                  onClick={() => clearAllMut.mutate()}
                  className="w-full text-xs text-gray-400 hover:text-red-500 font-medium transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
