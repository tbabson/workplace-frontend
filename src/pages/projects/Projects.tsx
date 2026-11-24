import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderKanban, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { projectsApi } from '../../api/projects';
import { departmentsApi } from '../../api/departments';
import type { Project, ProjectStatus } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/shared/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDate } from '../../utils/helpers';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface ProjectForm {
  title: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  department_id: string;
}

export default function Projects() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const role = (user?.role ?? '').toLowerCase().trim();
  const canManage = role === 'super_admin';
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then((r) => r.data.data ?? []),
  });

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProjectForm>();

  const cleanPayload = (d: ProjectForm) => ({
    title: d.title,
    description: d.description,
    status: d.status as ProjectStatus,
    start_date: d.start_date || null,
    end_date: d.end_date || null,
    department_id: d.department_id || null,
  });

  const createMut = useMutation({
    mutationFn: (d: ProjectForm) => projectsApi.create(cleanPayload(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setModalOpen(false); reset(); toast.success('Project created'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to create project');
    },
  });

  const updateMut = useMutation({
    mutationFn: (d: ProjectForm) => projectsApi.update(editing!.id, cleanPayload(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setModalOpen(false); setEditing(null); reset(); toast.success('Updated'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to update project');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Deleted'); },
    onError: () => toast.error('Failed'),
  });

  const onSubmit = (d: ProjectForm) => editing ? updateMut.mutate(d) : createMut.mutate(d);

  const openCreate = () => { setEditing(null); reset({ status: 'pending' }); setModalOpen(true); };
  const openEdit = (p: Project) => {
    setEditing(p);
    reset({ title: p.title, description: p.description, status: p.status, start_date: p.start_date ?? '', end_date: p.end_date ?? '', department_id: p.department_id ?? '' });
    setModalOpen(true);
  };

  const deptOptions = [
    { value: '', label: 'No Department' },
    ...(depts ?? []).map((d) => ({ value: d.id, label: d.name })),
  ];

  const projects = (Array.isArray(data) ? data : []).filter((p) => !filterStatus || p.status === filterStatus);

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={`${data?.length ?? 0} projects`}
        action={canManage ? <Button onClick={openCreate}><Plus size={16} /> New Project</Button> : undefined}
      />

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[{ value: '', label: 'All' }, ...STATUS_OPTIONS].map((s) => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(s.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterStatus === s.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects found" action={canManage ? <Button onClick={openCreate}>Create Project</Button> : undefined} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <Badge status={p.status} />
                  {canManage && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => { if (confirm('Delete?')) deleteMut.mutate(p.id); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{p.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{p.description}</p>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{p.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div
                      className="h-1.5 bg-indigo-600 rounded-full transition-all"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{p.start_date ? formatDate(p.start_date) : 'No start date'} → {p.end_date ? formatDate(p.end_date) : 'No end'}</span>
                  <Link to={`/projects/${p.id}`} className="flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 font-medium">
                    View <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); reset(); }} title={editing ? 'Edit Project' : 'New Project'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Title" error={errors.title?.message} {...register('title', { required: 'Title is required' })} />
          <Textarea label="Description" rows={3} {...register('description')} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" options={STATUS_OPTIONS} {...register('status')} />
            <Select label="Department" options={deptOptions} {...register('department_id')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" {...register('start_date')} />
            <Input label="End Date" type="date" {...register('end_date')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
