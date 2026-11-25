import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, CheckCircle2, Clock, Send as SendIcon, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { memosApi } from '../../api/memos';
import { usersApi } from '../../api/users';
import { departmentsApi } from '../../api/departments';
import type { Memo } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/shared/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDateTime, timeAgo, apiError } from '../../utils/helpers';
import { useAuthStore } from '../../store/authStore';
import { departmentOptions } from '../../utils/departments';
import toast from 'react-hot-toast';

interface MemoForm {
  title: string;
  content: string;
  recipient_id: string;
  department_id: string;
}

export default function Memos() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canCreate = user?.role === 'super_admin' || user?.role === 'dept_head';
  const isDeptHead = user?.role === 'dept_head';
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMemo, setViewMemo] = useState<Memo | null>(null);
  const [showAckList, setShowAckList] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['memos'],
    queryFn: () => memosApi.list().then((r) => r.data.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data.data),
  });

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
  });

  const { data: ackList } = useQuery({
    queryKey: ['memo-acks', viewMemo?.id],
    queryFn: () => memosApi.getAcknowledgements(viewMemo!.id).then((r) => r.data.data),
    enabled: !!viewMemo && showAckList,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<MemoForm>();

  const createMut = useMutation({
    mutationFn: (d: MemoForm) => memosApi.create({ ...d, recipient_id: d.recipient_id || undefined, department_id: (isDeptHead ? user?.department_id : d.department_id) || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['memos'] }); setModalOpen(false); reset(); toast.success('Memo sent'); },
    onError: (e) => toast.error(apiError(e, 'Failed to send memo')),
  });

  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => memosApi.acknowledge(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['memos'] });
      const now = new Date().toISOString();
      setViewMemo((prev) => prev?.id === id ? { ...prev, acknowledged_at: now } : prev);
      toast.success('Memo acknowledged');
    },
    onError: (e) => toast.error(apiError(e, 'Failed to acknowledge')),
  });

  const getUserName = (id: string) => users?.find((u) => u.id === id)?.name ?? 'Unknown';

  // Backend: company-wide broadcasts and other departments are super_admin only; a
  // dept_head may send to an individual or to their own department.
  const userOptions = [
    { value: '', label: isDeptHead ? 'Everyone in my department' : 'All (Broadcast)' },
    ...(users ?? []).filter((u) => u.id !== user?.id).map((u) => ({ value: u.id, label: u.name })),
  ];
  const deptOptions = isDeptHead
    ? departmentOptions(depts).filter((o) => o.value === user?.department_id)
    : [{ value: '', label: 'All Departments' }, ...departmentOptions(depts)];

  if (isLoading) return <PageSpinner />;
  const memos: Memo[] = data ?? [];

  const isRecipient = (m: Memo) => m.recipient_id === user?.id || m.recipient_id === null;
  const isUnread    = (m: Memo) => !m.acknowledged_at && isRecipient(m) && m.sender_id !== user?.id;

  return (
    <div>
      <PageHeader
        title="Memos"
        subtitle={`${memos.length} memos`}
        action={canCreate ? <Button onClick={() => setModalOpen(true)}><Plus size={16} /> New Memo</Button> : undefined}
      />

      {memos.length === 0 ? (
        <EmptyState icon={FileText} title="No memos" action={canCreate ? <Button onClick={() => setModalOpen(true)}>Create Memo</Button> : undefined} />
      ) : (
        <div className="space-y-3">
          {memos.map((m) => {
            const unread = isUnread(m);
            const isMine = m.sender_id === user?.id;
            return (
              <div
                key={m.id}
                onClick={() => { setViewMemo(m); setShowAckList(false); }}
                className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${
                  unread ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {unread && <div className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />}
                      <h3 className="font-semibold text-gray-900 truncate">{m.title}</h3>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{m.content}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <SendIcon size={11} /> {isMine ? 'You' : getUserName(m.sender_id)}
                      </span>
                      <span>·</span>
                      <span>{timeAgo(m.created_at)}</span>
                      {isMine && (
                        <>
                          <span>·</span>
                          <span className="text-green-600">{m.acknowledged_count} acknowledged</span>
                          {m.pending_count > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-amber-600">{m.pending_count} pending</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Acknowledgement badge */}
                  {m.acknowledged_at ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <CheckCircle2 size={11} /> Acknowledged
                    </span>
                  ) : isRecipient(m) && !isMine ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <Clock size={11} /> Pending
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Compose modal ── */}
      {canCreate && (
        <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="New Memo">
          <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
            <Input label="Title" {...register('title', { required: true })} />
            <Textarea label="Content" rows={4} {...register('content', { required: true })} />
            <Select label="Recipient (leave blank to broadcast)" options={userOptions} {...register('recipient_id')} />
            <Select label="Department" options={deptOptions} {...register('department_id')} />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
              <Button type="submit" loading={isSubmitting} className="flex-1">Send</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── View / Acknowledge modal ── */}
      <Modal open={!!viewMemo} onClose={() => { setViewMemo(null); setShowAckList(false); }} title={viewMemo?.title ?? ''} size="lg">
        {viewMemo && (() => {
          const isMine  = viewMemo.sender_id === user?.id;
          const canAck  = !isMine && isRecipient(viewMemo) && !viewMemo.acknowledged_at;
          return (
            <div className="space-y-4">
              {/* Meta */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                <span>From: <span className="font-medium text-gray-900">{getUserName(viewMemo.sender_id)}</span></span>
                <span>·</span>
                <span>{formatDateTime(viewMemo.created_at)}</span>
              </div>

              {/* Content */}
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[6rem]">
                {viewMemo.content}
              </div>

              {/* Acknowledgement status — recipient view */}
              {!isMine && viewMemo.acknowledged_at && (
                <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 rounded-xl">
                  <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">You acknowledged this memo</p>
                    <p className="text-xs text-green-600 mt-0.5">{formatDateTime(viewMemo.acknowledged_at)}</p>
                  </div>
                </div>
              )}

              {/* Sender sees acknowledged/pending counts + list */}
              {isMine && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1.5 text-green-700 font-medium">
                        <CheckCircle2 size={14} /> {viewMemo.acknowledged_count} acknowledged
                      </span>
                      {viewMemo.pending_count > 0 && (
                        <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                          <Clock size={14} /> {viewMemo.pending_count} pending
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowAckList((v) => !v)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      <Users size={13} /> {showAckList ? 'Hide' : 'Show'} list
                    </button>
                  </div>

                  {showAckList && (
                    <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                      {ackList && ackList.length > 0 ? ackList.map((a) => (
                        <div key={a.user_id} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-gray-800 font-medium">{a.user_name || a.user_id}</span>
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 size={11} /> {formatDateTime(a.acknowledged_at)}
                          </span>
                        </div>
                      )) : (
                        <p className="px-4 py-3 text-sm text-gray-400">No acknowledgements yet.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Acknowledge button — recipient only, unacknowledged only */}
              {canAck && (
                <div className="pt-1">
                  <Button
                    className="w-full"
                    onClick={() => acknowledgeMut.mutate(viewMemo.id)}
                    loading={acknowledgeMut.isPending}
                  >
                    <CheckCircle2 size={16} /> Acknowledge Receipt
                  </Button>
                  <p className="text-center text-xs text-gray-400 mt-2">
                    By clicking, you confirm you have read and received this memo.
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
