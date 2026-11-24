import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, HelpCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { queriesApi } from '../../api/queries';
import { usersApi } from '../../api/users';
import type { Query } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/shared/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDate, apiError } from '../../utils/helpers';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

interface QueryForm { title: string; content: string; recipient_id: string; }

export default function Queries() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isManager = user?.role === 'super_admin' || user?.role === 'dept_head';
  const [createModal, setCreateModal] = useState(false);
  const [respondModal, setRespondModal] = useState<Query | null>(null);
  const [response, setResponse] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['queries'],
    queryFn: () => queriesApi.list().then((r) => r.data.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<QueryForm>();

  const createMut = useMutation({
    mutationFn: (d: QueryForm) => queriesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['queries'] }); setCreateModal(false); reset(); toast.success('Query submitted'); },
    onError: (e) => toast.error(apiError(e, 'Failed to submit query')),
  });

  const respondMut = useMutation({
    mutationFn: ({ id, resp }: { id: string; resp: string }) => queriesApi.respond(id, resp),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['queries'] }); setRespondModal(null); setResponse(''); toast.success('Response sent'); },
    onError: (e) => toast.error(apiError(e, 'Failed to send response')),
  });

  const getUserName = (id: string) => users?.find((u) => u.id === id)?.name ?? 'Unknown';
  const managerOptions = (users ?? []).filter((u) => u.role === 'super_admin' || u.role === 'dept_head').map((u) => ({ value: u.id, label: u.name }));

  if (isLoading) return <PageSpinner />;
  const queries: Query[] = data ?? [];

  return (
    <div>
      <PageHeader
        title="Queries"
        subtitle={`${queries.length} queries`}
        action={<Button onClick={() => setCreateModal(true)}><Plus size={16} /> Submit Query</Button>}
      />

      {queries.length === 0 ? (
        <EmptyState icon={HelpCircle} title="No queries" action={<Button onClick={() => setCreateModal(true)}>Submit Query</Button>} />
      ) : (
        <div className="space-y-3">
          {queries.map((q) => (
            <div key={q.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900">{q.title}</h3>
                    <Badge status={q.status} />
                  </div>
                  <p className="text-sm text-gray-600">{q.content}</p>
                  {q.response && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg">
                      <p className="text-xs font-medium text-green-700 mb-1">Response:</p>
                      <p className="text-sm text-green-800">{q.response}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>From: {getUserName(q.issuer_id)}</span>
                    <span>→ To: {getUserName(q.recipient_id)}</span>
                    <span>· {formatDate(q.created_at)}</span>
                  </div>
                </div>
                {isManager && q.status === 'pending' && q.recipient_id === user?.id && (
                  <Button size="sm" variant="outline" onClick={() => setRespondModal(q)}>Respond</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createModal} onClose={() => { setCreateModal(false); reset(); }} title="Submit Query">
        <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
          <Input label="Title" {...register('title', { required: true })} />
          <Textarea label="Content" rows={3} {...register('content', { required: true })} />
          <Select label="Send To" options={managerOptions.length ? managerOptions : [{ value: '', label: 'No managers available' }]} {...register('recipient_id', { required: true })} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">Submit</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!respondModal} onClose={() => { setRespondModal(null); setResponse(''); }} title="Respond to Query">
        {respondModal && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">{respondModal.title}</p>
              <p className="text-sm text-gray-600">{respondModal.content}</p>
            </div>
            <Textarea
              label="Your Response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={3}
            />
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setRespondModal(null)} className="flex-1">Cancel</Button>
              <Button
                onClick={() => respondMut.mutate({ id: respondModal.id, resp: response })}
                loading={respondMut.isPending}
                disabled={!response.trim()}
                className="flex-1"
              >
                Send Response
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
