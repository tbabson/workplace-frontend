import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CalendarOff, Check, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { leavesApi } from '../../api/leaves';
import type { LeaveRequest, LeaveType } from '../../types';
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

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual' },
  { value: 'sick', label: 'Sick' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paternity', label: 'Paternity' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'other', label: 'Other' },
];

interface LeaveForm {
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
}

export default function Leaves() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isManager = user?.role === 'super_admin' || user?.role === 'dept_head';
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['leaves'],
    queryFn: () => leavesApi.list().then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<LeaveForm>();

  const createMut = useMutation({
    mutationFn: (d: LeaveForm) => leavesApi.create({ ...d, type: d.type as LeaveType }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); setModalOpen(false); reset(); toast.success('Leave request submitted'); },
    onError: (e) => toast.error(apiError(e, 'Failed to submit request')),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => leavesApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); toast.success('Approved'); },
    onError: (e) => toast.error(apiError(e, 'Failed to approve')),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => leavesApi.reject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); toast.success('Rejected'); },
    onError: (e) => toast.error(apiError(e, 'Failed to reject')),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => leavesApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); toast.success('Cancelled'); },
    onError: (e) => toast.error(apiError(e, 'Failed to cancel')),
  });

  if (isLoading) return <PageSpinner />;
  const leaves: LeaveRequest[] = data ?? [];

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle={`${leaves.length} requests`}
        action={<Button onClick={() => setModalOpen(true)}><Plus size={16} /> Apply for Leave</Button>}
      />

      {leaves.length === 0 ? (
        <EmptyState icon={CalendarOff} title="No leave requests" action={<Button onClick={() => setModalOpen(true)}>Apply for Leave</Button>} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {['Type', 'Period', 'Days', 'Reason', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium capitalize text-gray-900">{l.type}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(l.start_date)} – {formatDate(l.end_date)}</td>
                    <td className="px-4 py-3 text-gray-600">{l.days} days</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{l.reason}</td>
                    <td className="px-4 py-3"><Badge status={l.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {isManager && l.status === 'pending' && l.user_id !== user?.id && (
                          <>
                            <button onClick={() => approveMut.mutate(l.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Approve"><Check size={14} /></button>
                            <button onClick={() => rejectMut.mutate(l.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Reject"><X size={14} /></button>
                          </>
                        )}
                        {l.status === 'pending' && l.user_id === user?.id && (
                          <button onClick={() => cancelMut.mutate(l.id)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors">Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="Apply for Leave">
        <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
          <Select label="Leave Type" options={LEAVE_TYPES} {...register('type', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" {...register('start_date', { required: true })} />
            <Input label="End Date" type="date" {...register('end_date', { required: true })} />
          </div>
          <Textarea label="Reason" rows={3} {...register('reason', { required: true })} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">Submit</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
