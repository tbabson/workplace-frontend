import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { reviewsApi } from '../../api/reviews';
import { usersApi } from '../../api/users';
import type { Review } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/shared/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { formatDate, apiError } from '../../utils/helpers';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

interface ReviewForm { user_id: string; period: string; rating: number; goals: string; comments: string; }

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
      ))}
    </div>
  );
}

export default function Reviews() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isManager = user?.role === 'super_admin' || user?.role === 'dept_head';
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => reviewsApi.list().then((r) => r.data.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ReviewForm>();

  const createMut = useMutation({
    mutationFn: (d: ReviewForm) => reviewsApi.create({ ...d, rating: Number(d.rating) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reviews'] }); setModalOpen(false); reset(); toast.success('Review created'); },
    onError: (e) => toast.error(apiError(e, 'Failed to save review')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => reviewsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reviews'] }); toast.success('Deleted'); },
  });

  const getUserName = (id: string) => users?.find((u) => u.id === id)?.name ?? 'Unknown';
  // Backend rejects reviewing yourself.
  const userOptions = (users ?? []).filter((u) => u.id !== user?.id).map((u) => ({ value: u.id, label: u.name }));

  if (isLoading) return <PageSpinner />;
  const reviews: Review[] = data ?? [];

  return (
    <div>
      <PageHeader
        title="Performance Reviews"
        subtitle={`${reviews.length} reviews`}
        action={isManager ? <Button onClick={() => setModalOpen(true)}><Plus size={16} /> Add Review</Button> : undefined}
      />

      {reviews.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet" action={isManager ? <Button onClick={() => setModalOpen(true)}>Create Review</Button> : undefined} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar name={getUserName(r.user_id)} size="sm" />
                  <div>
                    <p className="font-semibold text-gray-900">{getUserName(r.user_id)}</p>
                    <p className="text-xs text-gray-400">Reviewed by {getUserName(r.reviewer_id)}</p>
                  </div>
                </div>
                {isManager && (
                  <button onClick={() => { if (confirm('Delete?')) deleteMut.mutate(r.id); }} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                )}
              </div>
              <div className="flex items-center gap-3 mb-3">
                <StarRating rating={r.rating} />
                <span className="text-sm font-medium text-gray-700">{r.rating}/5</span>
                <span className="text-xs text-gray-400">· {r.period}</span>
              </div>
              {r.goals && <div className="mb-2"><p className="text-xs font-medium text-gray-500 mb-0.5">Goals</p><p className="text-sm text-gray-700">{r.goals}</p></div>}
              {r.comments && <div><p className="text-xs font-medium text-gray-500 mb-0.5">Comments</p><p className="text-sm text-gray-600">{r.comments}</p></div>}
              <p className="text-xs text-gray-400 mt-3">{formatDate(r.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="Add Review" size="lg">
        <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
          <Select label="Employee" options={userOptions} {...register('user_id', { required: true })} />
          <Input label="Period (e.g., Q1 2024)" {...register('period', { required: true })} />
          <Select label="Rating" options={[1,2,3,4,5].map((n) => ({ value: String(n), label: `${n} Star${n > 1 ? 's' : ''}` }))} {...register('rating', { required: true })} />
          <Textarea label="Goals" rows={2} {...register('goals')} />
          <Textarea label="Comments" rows={2} {...register('comments')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
