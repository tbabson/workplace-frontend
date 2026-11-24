import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt, Check, X, DollarSign } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { claimsApi } from '../../api/claims';
import type { Claim } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/shared/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDate, formatCurrency, apiError } from '../../utils/helpers';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

interface ClaimForm { title: string; amount: number; date: string; description: string; receipt_url: string; }

export default function Claims() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  // Backend: super_admin/dept_head approve or reject, super_admin/procurement mark paid,
  // and nobody acts on their own claim.
  const canReview = user?.role === 'super_admin' || user?.role === 'dept_head';
  const canPay = user?.role === 'super_admin' || user?.role === 'procurement';
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['claims'],
    queryFn: () => claimsApi.list().then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ClaimForm>();

  const createMut = useMutation({
    mutationFn: (d: ClaimForm) => claimsApi.create({ ...d, amount: Number(d.amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['claims'] }); setModalOpen(false); reset(); toast.success('Claim submitted'); },
    onError: (e) => toast.error(apiError(e, 'Failed to submit claim')),
  });

  const approveMut = useMutation({ mutationFn: (id: string) => claimsApi.approve(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['claims'] }); toast.success('Approved'); }, onError: (e) => toast.error(apiError(e, 'Failed to approve')) });
  const rejectMut = useMutation({ mutationFn: (id: string) => claimsApi.reject(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['claims'] }); toast.success('Rejected'); }, onError: (e) => toast.error(apiError(e, 'Failed to reject')) });
  const payMut = useMutation({ mutationFn: (id: string) => claimsApi.pay(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['claims'] }); toast.success('Marked as paid'); }, onError: (e) => toast.error(apiError(e, 'Failed to mark as paid')) });

  if (isLoading) return <PageSpinner />;
  const claims: Claim[] = data ?? [];

  const totalPending = claims.filter((c) => c.status === 'pending').reduce((a, c) => a + c.amount, 0);
  const totalApproved = claims.filter((c) => c.status === 'approved' || c.status === 'paid').reduce((a, c) => a + c.amount, 0);

  return (
    <div>
      <PageHeader
        title="Expense Claims"
        subtitle={`${claims.length} claims`}
        action={<Button onClick={() => setModalOpen(true)}><Plus size={16} /> Submit Claim</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Claims', value: claims.length, icon: Receipt, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending Amount', value: formatCurrency(totalPending), icon: DollarSign, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Approved Amount', value: formatCurrency(totalApproved), icon: Check, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center`}><Icon size={20} className={color} /></div>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {claims.length === 0 ? (
        <EmptyState icon={Receipt} title="No claims" action={<Button onClick={() => setModalOpen(true)}>Submit Claim</Button>} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {['Title', 'Amount', 'Date', 'Description', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {claims.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(c.amount)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(c.date)}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.description}</td>
                    <td className="px-4 py-3"><Badge status={c.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canReview && c.status === 'pending' && c.user_id !== user?.id && (
                          <>
                            <button onClick={() => approveMut.mutate(c.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Approve"><Check size={14} /></button>
                            <button onClick={() => rejectMut.mutate(c.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Reject"><X size={14} /></button>
                          </>
                        )}
                        {canPay && c.status === 'approved' && c.user_id !== user?.id && (
                          <button onClick={() => payMut.mutate(c.id)} className="text-xs font-medium text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 transition-colors">Mark Paid</button>
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

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="Submit Expense Claim">
        <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
          <Input label="Title" {...register('title', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (₦)" type="number" step="0.01" {...register('amount', { required: true })} />
            <Input label="Date" type="date" {...register('date', { required: true })} />
          </div>
          <Textarea label="Description" rows={2} {...register('description', { required: true })} />
          <Input label="Receipt URL (optional)" {...register('receipt_url')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">Submit</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
