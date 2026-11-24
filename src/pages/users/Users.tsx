import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { usersApi } from '../../api/users';
import { departmentsApi } from '../../api/departments';
import type { User } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { PageHeader } from '../../components/shared/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { apiError } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'staff', label: 'Staff' },
  { value: 'dept_head', label: 'Department Head' },
  { value: 'procurement', label: 'Procurement Head' },
  { value: 'super_admin', label: 'Super Admin' },
];

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  position: string;
  department_id: string;
}

export default function Users() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data.data),
  });

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserForm>();

  const createMut = useMutation({
    mutationFn: (d: UserForm) => {
      // Send null rather than "" for optional fields: department_id is a UUID column.
      const selectedDept = (depts ?? []).find((dep) => dep.id === d.department_id);
      return usersApi.create({
        name: d.name,
        email: d.email,
        password: d.password,
        role: d.role as User['role'],
        position: d.position || null,
        department_id: d.department_id || null,
        department_name: selectedDept?.name ?? null,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setModalOpen(false); reset(); toast.success('User created'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to create user');
    },
  });

  const updateMut = useMutation({
    mutationFn: (d: UserForm) => {
      const selectedDept = (depts ?? []).find((dep) => dep.id === d.department_id);
      return usersApi.update(editing!.id, {
        name: d.name,
        email: d.email,
        role: d.role as User['role'],
        position: d.position || null,
        department_id: d.department_id || null,
        department_name: selectedDept?.name ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false); setEditing(null); reset();
      toast.success('User updated');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to update user');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted'); },
    onError: (e) => toast.error(apiError(e, 'Failed to delete user')),
  });

  const onSubmit = (d: UserForm) => editing ? updateMut.mutate(d) : createMut.mutate(d);

  const openCreate = () => { setEditing(null); reset(); setModalOpen(true); };
  const openEdit = (u: User) => {
    setEditing(u);
    reset({ name: u.name, email: u.email, role: u.role, position: u.position ?? '', department_id: u.department_id ?? '' });
    setModalOpen(true);
  };

  const filtered = (data ?? []).filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const deptOptions = [
    { value: '', label: 'No Department' },
    ...(depts ?? []).map((d) => ({ value: d.id, label: d.name })),
  ];

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={`${data?.length ?? 0} total users`}
        action={<Button onClick={openCreate}><Plus size={16} /> Add User</Button>}
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 w-full text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No users found" description="Try adjusting your search" />
        ) : (
          <>
            {/* ── Mobile cards ── */}
            <div className="divide-y divide-gray-50 md:hidden">
              {filtered.map((u) => (
                <div key={u.id} className="px-4 py-3 flex items-start gap-3">
                  <Avatar name={u.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-900 truncate">{u.name}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => { if (confirm('Delete this user?')) deleteMut.mutate(u.id); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Badge status={u.role} />
                      {u.department_name && (
                        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{u.department_name}</span>
                      )}
                      {u.is_active ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><UserCheck size={12} /> Active</span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400 text-xs font-medium"><UserX size={12} /> Inactive</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    {['User', 'Email', 'Role', 'Department', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} size="sm" />
                          <span className="font-medium text-gray-900">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3"><Badge status={u.role} /></td>
                      <td className="px-4 py-3 text-gray-600">{u.department_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        {u.is_active ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><UserCheck size={13} /> Active</span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400 text-xs font-medium"><UserX size={13} /> Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { if (confirm('Delete this user?')) deleteMut.mutate(u.id); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); reset(); }} title={editing ? 'Edit User' : 'Add User'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Full Name" error={errors.name?.message} {...register('name', { required: 'Name is required' })} />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email', { required: 'Email is required' })} />
          {!editing && (
            <Input label="Password" type="password" error={errors.password?.message} {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'At least 8 characters' } })} />
          )}
          <Input label="Position" {...register('position')} />
          <Select label="Role" options={ROLES} {...register('role', { required: 'Role is required' })} error={errors.role?.message} />
          <Select label="Department" options={deptOptions} {...register('department_id')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditing(null); reset(); }} className="flex-1">Cancel</Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
