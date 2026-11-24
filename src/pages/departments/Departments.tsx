import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Building2, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { departmentsApi } from '../../api/departments';
import { usersApi } from '../../api/users';
import type { Department } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { PageHeader } from '../../components/shared/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { Card, CardBody } from '../../components/ui/Card';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

interface DeptForm {
  name: string;
  head_id: string;
}

export default function Departments() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DeptForm>();

  const createMut = useMutation({
    mutationFn: (d: DeptForm) => departmentsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setModalOpen(false); reset(); toast.success('Department created'); },
    onError: () => toast.error('Failed to create department'),
  });

  const updateMut = useMutation({
    mutationFn: (d: DeptForm) => departmentsApi.update(editing!.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setModalOpen(false); setEditing(null); reset(); toast.success('Updated'); },
    onError: () => toast.error('Failed to update'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => departmentsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success('Deleted'); },
    onError: () => toast.error('Failed to delete'),
  });

  const onSubmit = (d: DeptForm) => editing ? updateMut.mutate(d) : createMut.mutate(d);

  const openCreate = () => { setEditing(null); reset(); setModalOpen(true); };
  const openEdit = (dep: Department) => {
    setEditing(dep);
    reset({ name: dep.name, head_id: dep.head_id ?? '' });
    setModalOpen(true);
  };

  const userOptions = [
    { value: '', label: 'No Head' },
    ...(users ?? []).map((u) => ({ value: u.id, label: u.name })),
  ];

  const getUserName = (id: string | null) => users?.find((u) => u.id === id)?.name ?? '—';

  // Group users by department_id
  const membersByDept = useMemo(() => {
    const map = new Map<string, typeof users>();
    for (const u of users ?? []) {
      if (!u.department_id) continue;
      if (!map.has(u.department_id)) map.set(u.department_id, []);
      map.get(u.department_id)!.push(u);
    }
    return map;
  }, [users]);

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle={`${data?.length ?? 0} departments`}
        action={<Button onClick={openCreate}><Plus size={16} /> Add Department</Button>}
      />

      {!data?.length ? (
        <EmptyState icon={Building2} title="No departments yet" action={<Button onClick={openCreate}>Add Department</Button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((dep) => {
            const members = membersByDept.get(dep.id) ?? [];
            return (
              <Card key={dep.id}>
                <CardBody>
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <Building2 size={20} className="text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{dep.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Head: {getUserName(dep.head_id)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(dep)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete department?')) deleteMut.mutate(dep.id); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Member count badge */}
                  <div className="flex items-center gap-1.5 mt-3">
                    <Users size={13} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-500">
                      {members.length} {members.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>

                  {/* Member list */}
                  <div className="mt-3 pt-3 border-t border-gray-50 space-y-2 max-h-48 overflow-y-auto">
                    {members.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No members yet</p>
                    ) : members.map((m) => (
                      <div key={m.id} className="flex items-center gap-2">
                        <Avatar name={m.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{m.name}</p>
                          {m.position && (
                            <p className="text-[11px] text-gray-400 truncate">{m.position}</p>
                          )}
                        </div>
                        <Badge status={m.role} />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-50 text-xs text-gray-400">
                    Created {formatDate(dep.created_at)}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); reset(); }} title={editing ? 'Edit Department' : 'Add Department'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Department Name" error={errors.name?.message} {...register('name', { required: 'Name is required' })} />
          <Select label="Department Head" options={userOptions} {...register('head_id')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
