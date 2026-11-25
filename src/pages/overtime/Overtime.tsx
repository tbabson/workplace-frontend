import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Timer, DollarSign, Trash2, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { overtimeApi } from '../../api/overtime';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/shared/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDateTime, formatCurrency, localDateTimeInput, apiError } from '../../utils/helpers';
import { departmentsApi } from '../../api/departments';
import { isInDepartmentTree } from '../../utils/departments';
import toast from 'react-hot-toast';

interface OvertimeForm {
  user_id: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  notes: string;
}

interface EditForm {
  end_time: string;
  hourly_rate: number;
  notes: string;
}

export default function Overtime() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isManager = user?.role === 'super_admin' || user?.role === 'dept_head';
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['overtime'],
    queryFn: () => overtimeApi.list().then((r) => r.data.data),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data.data),
    enabled: isManager,
  });

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
  });

  const staffList = (usersData ?? []).filter((u) => {
    if (u.role === 'super_admin') return false;
    // Dept heads oversee their department and its sub-departments.
    if (user?.role === 'dept_head') return isInDepartmentTree(u.department_id, user.department_id, depts);
    return true; // super_admin sees everyone
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<OvertimeForm>();
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { isSubmitting: editSubmitting } } = useForm<EditForm>();

  const createMut = useMutation({
    mutationFn: (d: OvertimeForm) => {
      const toISO = (s: string) => new Date(s).toISOString();
      return overtimeApi.create({
        user_id: d.user_id,
        start_time: toISO(d.start_time),
        end_time: d.end_time ? toISO(d.end_time) : undefined,
        hourly_rate: Number(d.hourly_rate),
        notes: d.notes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overtime'] });
      qc.invalidateQueries({ queryKey: ['ot-report'] });
      setModalOpen(false);
      reset();
      toast.success('Overtime logged — staff has been notified');
    },
    onError: (e) => toast.error(apiError(e, 'Failed to log overtime')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => overtimeApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overtime'] });
      qc.invalidateQueries({ queryKey: ['ot-report'] });
      toast.success('Overtime record deleted');
    },
    onError: (e) => toast.error(apiError(e, 'Failed to delete')),
  });

  const markPaidMut = useMutation({
    mutationFn: (id: string) => overtimeApi.markPaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overtime'] });
      qc.invalidateQueries({ queryKey: ['ot-report'] });
      toast.success('Marked as paid — staff has been notified');
    },
    onError: (e) => toast.error(apiError(e, 'Failed to mark as paid')),
  });

  const updateMut = useMutation({
    mutationFn: (d: EditForm) => {
      const payload: { end_time?: string; hourly_rate?: number; notes?: string } = {
        hourly_rate: Number(d.hourly_rate),
        notes: d.notes,
      };
      if (d.end_time) payload.end_time = new Date(d.end_time).toISOString();
      return overtimeApi.update(editingId!, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overtime'] });
      qc.invalidateQueries({ queryKey: ['ot-report'] });
      setEditingId(null);
      resetEdit();
      toast.success('Overtime record updated');
    },
    onError: (e) => toast.error(apiError(e, 'Failed to update')),
  });

  const openEdit = (o: (typeof list)[number]) => {
    resetEdit({
      end_time: o.end_time ? localDateTimeInput(o.end_time) : '',
      hourly_rate: o.hourly_rate,
      notes: o.notes ?? '',
    });
    setEditingId(o.id);
  };

  if (isLoading) return <PageSpinner />;
  const list = data ?? [];

  const totalHours = list.reduce((a, o) => a + (o.hours ?? 0), 0);
  const totalAmount = list.reduce((a, o) => a + (o.total_amount ?? 0), 0);
  const unpaid = list.filter((o) => !o.is_paid).reduce((a, o) => a + (o.total_amount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Overtime"
        subtitle="Track overtime hours and payments"
        action={
          isManager ? (
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Log Overtime
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Hours', value: `${totalHours.toFixed(1)}h`, icon: Timer, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Amount', value: formatCurrency(totalAmount), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Unpaid', value: formatCurrency(unpaid), icon: DollarSign, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Timer}
          title="No overtime records"
          action={isManager ? <Button onClick={() => setModalOpen(true)}>Log Overtime</Button> : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-gray-100">
            {list.map((o) => (
              <div key={o.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900 truncate">{o.user_name || o.user_id}</span>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    o.is_paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {o.is_paid ? 'Paid' : 'Unpaid'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p><span className="text-gray-400">Start: </span>{formatDateTime(o.start_time)}</p>
                  <p><span className="text-gray-400">End: </span>{o.end_time ? formatDateTime(o.end_time) : '—'}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-700 font-medium">{o.hours?.toFixed(1) ?? '—'}h</span>
                  <span className="text-gray-400 text-xs">{formatCurrency(o.hourly_rate)}/hr</span>
                  <span className="font-semibold text-gray-900">{o.total_amount ? formatCurrency(o.total_amount) : '—'}</span>
                </div>
                {o.notes && <p className="text-xs text-gray-500 truncate">{o.notes}</p>}
                {isManager && (
                  <div className="flex items-center gap-1 pt-1">
                    {!o.is_paid && (
                      <button
                        onClick={() => markPaidMut.mutate(o.id)}
                        disabled={markPaidMut.isPending}
                        className="text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded hover:bg-green-50 transition-colors disabled:opacity-50"
                      >
                        Mark Paid
                      </button>
                    )}
                    <button onClick={() => openEdit(o)} className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this overtime record?')) deleteMut.mutate(o.id); }}
                      disabled={deleteMut.isPending}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {['Staff', 'Start', 'End', 'Hours', 'Rate', 'Total', 'Notes', 'Status', isManager ? 'Actions' : ''].filter(Boolean).map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.user_name || o.user_id}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDateTime(o.start_time)}</td>
                    <td className="px-4 py-3 text-gray-700">{o.end_time ? formatDateTime(o.end_time) : '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{o.hours?.toFixed(1) ?? '—'}h</td>
                    <td className="px-4 py-3 text-gray-700">{formatCurrency(o.hourly_rate)}/hr</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{o.total_amount ? formatCurrency(o.total_amount) : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{o.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        o.is_paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {o.is_paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    {isManager && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {!o.is_paid && (
                            <button
                              onClick={() => markPaidMut.mutate(o.id)}
                              disabled={markPaidMut.isPending}
                              className="text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded hover:bg-green-50 transition-colors disabled:opacity-50"
                            >
                              Mark Paid
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(o)}
                            className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { if (confirm('Delete this overtime record?')) deleteMut.mutate(o.id); }}
                            disabled={deleteMut.isPending}
                            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit modal */}
      <Modal open={!!editingId} onClose={() => { setEditingId(null); resetEdit(); }} title="Edit Overtime">
        <form onSubmit={handleEdit((d) => updateMut.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="End Time"
              type="datetime-local"
              {...regEdit('end_time')}
            />
            <Input
              label="Hourly Rate (₦) *"
              type="number"
              step="0.01"
              min="0"
              {...regEdit('hourly_rate', { required: true, valueAsNumber: true })}
            />
          </div>
          <Textarea label="Notes" rows={2} {...regEdit('notes')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { setEditingId(null); resetEdit(); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={editSubmitting || updateMut.isPending} className="flex-1">
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create modal — managers only */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="Log Overtime">
        <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
          {/* Staff selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Staff Member <span className="text-red-500">*</span>
            </label>
            <select
              {...register('user_id', { required: 'Please select a staff member' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select staff member…</option>
              {staffList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.department_name ? `— ${u.department_name}` : ''}
                </option>
              ))}
            </select>
            {errors.user_id && (
              <p className="mt-1 text-xs text-red-500">{errors.user_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Time *"
              type="datetime-local"
              {...register('start_time', { required: true })}
            />
            <Input
              label="End Time"
              type="datetime-local"
              {...register('end_time')}
            />
          </div>

          <Input
            label="Hourly Rate (₦) *"
            type="number"
            step="0.01"
            min="0"
            {...register('hourly_rate', { required: true, valueAsNumber: true })}
          />

          <Textarea label="Notes" rows={2} {...register('notes')} />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); reset(); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || createMut.isPending} className="flex-1">
              Submit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
