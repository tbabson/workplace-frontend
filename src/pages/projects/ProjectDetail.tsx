import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, CheckCircle, Circle, Milestone, MessageCircle, DollarSign, Trash2, UserMinus,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { projectsApi } from '../../api/projects';
import { usersApi } from '../../api/users';
import type { Task, ProjectComment } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { PageSpinner } from '../../components/ui/Spinner';
import { formatDate, formatCurrency, timeAgo, localDate, apiError } from '../../utils/helpers';
import { useAuthStore } from '../../store/authStore';
import { departmentsApi } from '../../api/departments';
import { isInDepartmentTree } from '../../utils/departments';
import toast from 'react-hot-toast';

const TABS = ['Tasks', 'Members', 'Milestones', 'Comments', 'Budget'] as const;
type Tab = typeof TABS[number];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const role = (user?.role ?? '').toLowerCase().trim();
  const isAdmin = role === 'super_admin';
  const canManageBudget = role === 'super_admin' || role === 'procurement';
  const [tab, setTab] = useState<Tab>('Tasks');
  const [taskModal, setTaskModal] = useState(false);
  const [milestoneModal, setMilestoneModal] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => projectsApi.listTasks(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: milestones } = useQuery({
    queryKey: ['milestones', id],
    queryFn: () => projectsApi.listMilestones(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: comments } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => projectsApi.listComments(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: budget } = useQuery({
    queryKey: ['budget', id],
    queryFn: () => projectsApi.getBudget(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data.data),
  });

  const { data: assigneeIds } = useQuery({
    queryKey: ['assignees', id],
    queryFn: () => projectsApi.getAssignees(id!).then((r) => r.data.data ?? []),
    enabled: !!id,
  });

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
  });

  // Backend rules: super_admin manages any project's duties; a dept head who is on
  // the project manages duties for staff in their department and its sub-departments.
  const members = (users ?? []).filter((u) => (assigneeIds ?? []).includes(u.id));
  const isMember = !!user && (assigneeIds ?? []).includes(user.id);
  const canManageTasks = isAdmin || (role === 'dept_head' && isMember);
  const assignableMembers = isAdmin
    ? members
    : members.filter((u) => isInDepartmentTree(u.department_id, user?.department_id, depts));
  const [memberToAdd, setMemberToAdd] = useState('');

  const assignMut = useMutation({
    mutationFn: (userId: string) => projectsApi.assign(id!, userId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['assignees', id] });
      setMemberToAdd('');
      toast.success((res.data as { data?: { message?: string } })?.data?.message ?? 'Member added');
    },
    onError: (e) => toast.error(apiError(e, 'Failed to add member')),
  });

  const unassignMut = useMutation({
    mutationFn: (userId: string) => projectsApi.unassign(id!, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignees', id] }); toast.success('Member removed'); },
    onError: (e) => toast.error(apiError(e, 'Failed to remove member')),
  });

  // Task form
  const taskForm = useForm<Partial<Task>>();
  const createTaskMut = useMutation({
    mutationFn: (d: Partial<Task>) => projectsApi.createTask(id!, {
      title: d.title,
      description: d.description || '',
      due_date: d.due_date || undefined,
      assigned_to: d.assigned_to || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', id] }); setTaskModal(false); taskForm.reset(); toast.success('Task created'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to create task');
    },
  });

  const updateTaskMut = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      projectsApi.updateTask(taskId, { status: status as Task['status'] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', id] }),
    onError: (e) => toast.error(apiError(e, 'Failed to update task')),
  });

  const deleteTaskMut = useMutation({
    mutationFn: (taskId: string) => projectsApi.deleteTask(taskId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', id] }); toast.success('Task deleted'); },
    onError: (e) => toast.error(apiError(e, 'Failed to delete task')),
  });

  // Milestone form
  const msForm = useForm<{ title: string; due_date: string }>();
  const createMsMut = useMutation({
    mutationFn: (d: { title: string; due_date: string }) => projectsApi.createMilestone(id!, {
      title: d.title,
      due_date: d.due_date || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['milestones', id] }); setMilestoneModal(false); msForm.reset(); toast.success('Milestone created'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to create milestone');
    },
  });

  const achieveMsMut = useMutation({
    mutationFn: (msId: string) => projectsApi.achieveMilestone(msId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['milestones', id] }),
  });

  // Budget
  const [budgetModal, setBudgetModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const budgetForm = useForm<{ budget: number }>();
  const expenseForm = useForm<{ description: string; amount: number; date: string }>();

  const setBudgetMut = useMutation({
    mutationFn: (d: { budget: number }) => projectsApi.setBudget(id!, Number(d.budget)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget', id] }); setBudgetModal(false); budgetForm.reset(); toast.success('Budget set'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to set budget');
    },
  });

  const addExpenseMut = useMutation({
    mutationFn: (d: { description: string; amount: number; date: string }) =>
      projectsApi.addExpense(id!, { ...d, amount: Number(d.amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget', id] }); setExpenseModal(false); expenseForm.reset(); toast.success('Expense added'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to add expense');
    },
  });

  const deleteExpenseMut = useMutation({
    mutationFn: (expenseId: string) => projectsApi.deleteExpense(id!, expenseId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget', id] }); toast.success('Expense deleted'); },
    onError: () => toast.error('Failed to delete expense'),
  });

  // Comment
  const [commentText, setCommentText] = useState('');
  const addCommentMut = useMutation({
    mutationFn: () => projectsApi.createComment(id!, { content: commentText }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments', id] }); setCommentText(''); },
  });

  const getUserName = (uid: string) => users?.find((u) => u.id === uid)?.name ?? 'Unknown';

  if (isLoading) return <PageSpinner />;
  if (!project) return <div className="p-6 text-gray-500">Project not found</div>;

  return (
    <div>
      <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors">
        <ArrowLeft size={16} /> Back to Projects
      </button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{project.description}</p>
          </div>
          <Badge status={project.status} />
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-500 mt-4">
          <span>Start: {formatDate(project.start_date)}</span>
          <span>End: {formatDate(project.end_date)}</span>
          <span>Progress: {project.progress}%</span>
        </div>
        <div className="mt-3 h-2 bg-gray-100 rounded-full">
          <div className="h-2 bg-indigo-600 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tasks */}
      {tab === 'Tasks' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Tasks ({tasks?.length ?? 0})</h3>
            {canManageTasks && (
              <Button size="sm" onClick={() => { taskForm.reset({ status: 'todo' }); setTaskModal(true); }}>
                <Plus size={14} /> Add Task
              </Button>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {!tasks?.length ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No tasks yet</div>
            ) : (
              tasks.map((t: Task) => {
                // Backend: only super_admin or the task's assignee may change its status.
                const canToggle = canManageTasks || t.assigned_to === user?.id;
                return (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                  <button
                    onClick={() => canToggle && updateTaskMut.mutate({ taskId: t.id, status: t.status === 'done' ? 'todo' : 'done' })}
                    disabled={!canToggle}
                    title={canToggle ? undefined : 'Only the assignee can update this task'}
                    className={canToggle ? 'shrink-0 text-gray-400 hover:text-indigo-600' : 'shrink-0 text-gray-300 cursor-default'}
                  >
                    {t.status === 'done' ? <CheckCircle size={18} className="text-green-500" /> : <Circle size={18} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.title}</p>
                    {t.due_date && <p className="text-xs text-gray-400">Due {formatDate(t.due_date)}</p>}
                  </div>
                  <Badge status={t.status} />
                  {canManageTasks && (
                    <button
                      onClick={() => { if (confirm('Delete task?')) deleteTaskMut.mutate(t.id); }}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Members */}
      {tab === 'Members' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Members ({members.length})</h3>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Select
                  options={[
                    { value: '', label: 'Add a member…' },
                    ...(users ?? [])
                      .filter((u) => u.is_active && !(assigneeIds ?? []).includes(u.id))
                      .map((u) => ({
                        value: u.id,
                        label: u.role === 'dept_head' ? `${u.name} (Dept head — adds their department)` : u.name,
                      })),
                  ]}
                  value={memberToAdd}
                  onChange={(e) => setMemberToAdd(e.target.value)}
                />
                <Button size="sm" disabled={!memberToAdd} loading={assignMut.isPending} onClick={() => assignMut.mutate(memberToAdd)}>
                  <Plus size={14} /> Add
                </Button>
              </div>
            )}
          </div>
          {role === 'dept_head' && isMember && (
            <p className="px-5 pt-3 text-xs text-gray-500">
              Staff from your department were added with you. Give each of them a duty from the Tasks tab.
            </p>
          )}
          <div className="divide-y divide-gray-50">
            {!members.length ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No members yet</div>
            ) : (
              members.map((m) => {
                const hasDuty = (tasks ?? []).some((t: Task) => t.assigned_to === m.id);
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={m.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-400 capitalize">
                        {m.role.replace(/_/g, ' ')}{m.department_name ? ` · ${m.department_name}` : ''}
                      </p>
                    </div>
                    {!hasDuty && m.role !== 'dept_head' && m.role !== 'super_admin' && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Awaiting duty</span>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => { if (confirm(`Remove ${m.name} from this project?`)) unassignMut.mutate(m.id); }}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        title="Remove from project"
                      >
                        <UserMinus size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Milestones */}
      {tab === 'Milestones' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Milestones</h3>
            {isAdmin && <Button size="sm" onClick={() => setMilestoneModal(true)}><Plus size={14} /> Add Milestone</Button>}
          </div>
          <div className="divide-y divide-gray-50">
            {!milestones?.length ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No milestones yet</div>
            ) : (
              milestones.map((ms) => (
                <div key={ms.id} className="flex items-center gap-3 px-5 py-3">
                  <button
                    onClick={() => isAdmin && !ms.achieved_at && achieveMsMut.mutate(ms.id)}
                    className={ms.achieved_at ? 'text-green-500 cursor-default' : isAdmin ? 'text-gray-400 hover:text-green-500' : 'text-gray-300 cursor-default'}
                  >
                    {ms.achieved_at ? <CheckCircle size={18} /> : <Milestone size={18} />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${ms.achieved_at ? 'line-through text-gray-400' : 'text-gray-900'}`}>{ms.title}</p>
                    <p className="text-xs text-gray-400">Due {formatDate(ms.due_date)}</p>
                  </div>
                  {ms.achieved_at && <span className="text-xs text-green-600 font-medium">Achieved</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Comments */}
      {tab === 'Comments' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><MessageCircle size={16} /> Comments</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {!comments?.length ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No comments yet</div>
            ) : (
              comments.map((c: ProjectComment) => (
                <div key={c.id} className="flex gap-3 px-5 py-3">
                  <Avatar name={getUserName(c.author_id)} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{getUserName(c.author_id)}</span>
                      <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
            {user && <Avatar name={user.name} size="sm" />}
            <div className="flex-1 flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim()) addCommentMut.mutate(); }}
              />
              <Button size="sm" onClick={() => addCommentMut.mutate()} disabled={!commentText.trim()}>Post</Button>
            </div>
          </div>
        </div>
      )}

      {/* Budget */}
      {tab === 'Budget' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-green-600" />
              <h3 className="font-semibold text-gray-900">Budget</h3>
            </div>
            {canManageBudget && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { budgetForm.reset({ budget: budget?.budget ?? 0 }); setBudgetModal(true); }}>
                  {budget?.budget ? 'Update Budget' : 'Set Budget'}
                </Button>
                <Button size="sm" onClick={() => { expenseForm.reset({ date: localDate() }); setExpenseModal(true); }}>
                  <Plus size={14} /> Add Expense
                </Button>
              </div>
            )}
          </div>
          <div className="px-5 py-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Total Budget</p>
                <p className="text-lg font-bold text-green-700">{budget?.budget ? formatCurrency(budget.budget) : '—'}</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Spent</p>
                <p className="text-lg font-bold text-red-700">{formatCurrency(budget?.spent ?? 0)}</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Remaining</p>
                <p className="text-lg font-bold text-blue-700">
                  {budget?.budget ? formatCurrency(budget.budget - (budget.spent ?? 0)) : '—'}
                </p>
              </div>
            </div>

            {/* Budget progress bar */}
            {budget?.budget ? (
              <div className="mb-6">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Spend utilization</span>
                  <span>{Math.min(100, Math.round(((budget.spent ?? 0) / budget.budget) * 100))}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div
                    className={`h-2 rounded-full transition-all ${(budget.spent ?? 0) > budget.budget ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, ((budget.spent ?? 0) / budget.budget) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}

            {/* Expenses list */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Expenses</h4>
              <span className="text-xs text-gray-400">{budget?.expenses?.length ?? 0} entries</span>
            </div>
            <div className="space-y-2">
              {!budget?.expenses?.length ? (
                <p className="text-sm text-gray-400 py-4 text-center">No expenses logged yet</p>
              ) : (
                budget.expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.description}</p>
                      {e.date && <p className="text-xs text-gray-400">{formatDate(e.date)}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(e.amount)}</span>
                      {isAdmin && (
                        <button
                          onClick={() => { if (confirm('Delete this expense?')) deleteExpenseMut.mutate(e.id); }}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      <Modal open={taskModal} onClose={() => { setTaskModal(false); taskForm.reset(); }} title="Add Task">
        <form onSubmit={taskForm.handleSubmit((d) => createTaskMut.mutate(d))} className="space-y-4">
          <Input label="Title" {...taskForm.register('title', { required: true })} />
          <Textarea label="Description" rows={2} {...taskForm.register('description')} />
          <Select
            label="Status"
            options={[{ value: 'todo', label: 'To Do' }, { value: 'in_progress', label: 'In Progress' }, { value: 'done', label: 'Done' }]}
            {...taskForm.register('status')}
          />
          <Input label="Due Date" type="date" {...taskForm.register('due_date')} />
          <Select
            label="Assign To"
            options={[{ value: '', label: 'Unassigned' }, ...assignableMembers.map((u) => ({ value: u.id, label: u.name }))]}
            {...taskForm.register('assigned_to')}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setTaskModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={createTaskMut.isPending} className="flex-1">Create</Button>
          </div>
        </form>
      </Modal>

      {/* Set Budget Modal */}
      <Modal open={budgetModal} onClose={() => setBudgetModal(false)} title="Set Project Budget">
        <form onSubmit={budgetForm.handleSubmit((d) => setBudgetMut.mutate(d))} className="space-y-4">
          <Input label="Budget Amount (₦)" type="number" min="0" step="0.01" {...budgetForm.register('budget', { required: true, min: 0 })} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setBudgetModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={setBudgetMut.isPending} className="flex-1">Save Budget</Button>
          </div>
        </form>
      </Modal>

      {/* Add Expense Modal */}
      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title="Add Expense">
        <form onSubmit={expenseForm.handleSubmit((d) => addExpenseMut.mutate(d))} className="space-y-4">
          <Input label="Description" {...expenseForm.register('description', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (₦)" type="number" min="0" step="0.01" {...expenseForm.register('amount', { required: true, min: 0 })} />
            <Input label="Date" type="date" {...expenseForm.register('date', { required: true })} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setExpenseModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={addExpenseMut.isPending} className="flex-1">Add Expense</Button>
          </div>
        </form>
      </Modal>

      {/* Milestone Modal */}
      <Modal open={milestoneModal} onClose={() => setMilestoneModal(false)} title="Add Milestone">
        <form onSubmit={msForm.handleSubmit((d) => createMsMut.mutate(d))} className="space-y-4">
          <Input label="Title" {...msForm.register('title', { required: true })} />
          <Input label="Due Date" type="date" {...msForm.register('due_date', { required: true })} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setMilestoneModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={createMsMut.isPending} className="flex-1">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
