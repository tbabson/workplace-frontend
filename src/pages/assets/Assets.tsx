import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { assetsApi } from '../../api/assets';
import { usersApi } from '../../api/users';
import type { Asset, AssetStatus } from '../../types';
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

interface AssetForm { name: string; category: string; serial_number: string; description: string; status: string; }

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

export default function Assets() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  // Backend: only super_admin and procurement manage assets; staff see only their own.
  const canManage = user?.role === 'super_admin' || user?.role === 'procurement';
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [assignModal, setAssignModal] = useState<Asset | null>(null);
  const [assignUserId, setAssignUserId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetsApi.list().then((r) => r.data.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<AssetForm>();

  const createMut = useMutation({
    mutationFn: (d: AssetForm) => assetsApi.create({ ...d, status: d.status as AssetStatus }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setModalOpen(false); reset(); toast.success('Asset created'); },
    onError: (e) => toast.error(apiError(e, 'Failed to create asset')),
  });

  const updateMut = useMutation({
    mutationFn: (d: AssetForm) => assetsApi.update(editing!.id, { ...d, status: d.status as AssetStatus }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setModalOpen(false); setEditing(null); reset(); toast.success('Updated'); },
    onError: (e) => toast.error(apiError(e, 'Failed to update asset')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => assetsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Deleted'); },
    onError: (e) => toast.error(apiError(e, 'Failed to delete asset')),
  });

  const assignMut = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => assetsApi.assign(id, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setAssignModal(null); toast.success('Asset assigned'); },
    onError: (e) => toast.error(apiError(e, 'Failed to assign asset')),
  });

  const unassignMut = useMutation({
    mutationFn: (id: string) => assetsApi.unassign(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Asset unassigned'); },
    onError: (e) => toast.error(apiError(e, 'Failed to unassign asset')),
  });

  const onSubmit = (d: AssetForm) => editing ? updateMut.mutate(d) : createMut.mutate(d);

  const openCreate = () => { setEditing(null); reset({ status: 'available' }); setModalOpen(true); };
  const openEdit = (a: Asset) => {
    setEditing(a);
    reset({ name: a.name, category: a.category, serial_number: a.serial_number ?? '', description: a.description ?? '', status: a.status });
    setModalOpen(true);
  };

  const getUserName = (id: string | null) => id ? (users?.find((u) => u.id === id)?.name ?? id) : '—';
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.name }));

  if (isLoading) return <PageSpinner />;
  const assets: Asset[] = data ?? [];

  return (
    <div>
      <PageHeader title="Assets" subtitle={`${assets.length} assets`} action={canManage ? <Button onClick={openCreate}><Plus size={16} /> Add Asset</Button> : undefined} />

      {assets.length === 0 ? (
        <EmptyState icon={Package} title="No assets" action={canManage ? <Button onClick={openCreate}>Add Asset</Button> : undefined} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {['Name', 'Category', 'Serial No.', 'Status', 'Assigned To', 'Since', ...(canManage ? ['Actions'] : [])].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {assets.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-3 text-gray-600">{a.category}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.serial_number ?? '—'}</td>
                    <td className="px-4 py-3"><Badge status={a.status} /></td>
                    <td className="px-4 py-3 text-gray-600">{getUserName(a.assigned_to)}</td>
                    <td className="px-4 py-3 text-gray-500">{a.assigned_at ? formatDate(a.assigned_at) : '—'}</td>
                    {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Pencil size={13} /></button>
                        {!a.assigned_to ? (
                          <button onClick={() => { setAssignModal(a); setAssignUserId(''); }} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Assign"><UserCheck size={13} /></button>
                        ) : (
                          <button onClick={() => unassignMut.mutate(a.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors" title="Unassign"><UserX size={13} /></button>
                        )}
                        <button onClick={() => { if (confirm('Delete?')) deleteMut.mutate(a.id); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
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

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); reset(); }} title={editing ? 'Edit Asset' : 'Add Asset'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Name" {...register('name', { required: true })} />
          <Input label="Category" {...register('category', { required: true })} />
          <Input label="Serial Number" {...register('serial_number')} />
          <Textarea label="Description" rows={2} {...register('description')} />
          <Select label="Status" options={STATUS_OPTIONS} {...register('status')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!assignModal} onClose={() => setAssignModal(null)} title="Assign Asset">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Assign <strong>{assignModal?.name}</strong> to:</p>
          <Select label="Employee" options={[{ value: '', label: 'Select employee' }, ...userOptions]} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} />
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setAssignModal(null)} className="flex-1">Cancel</Button>
            <Button
              onClick={() => assignMut.mutate({ id: assignModal!.id, userId: assignUserId })}
              loading={assignMut.isPending}
              disabled={!assignUserId}
              className="flex-1"
            >
              Assign
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
