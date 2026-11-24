import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn, LogOut, Clock, MapPin, AlertCircle } from 'lucide-react';
import { attendanceApi } from '../../api/attendance';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/authStore';
import type { Attendance } from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/shared/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { formatDate, formatDateTime, localDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function AttendancePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'dept_head';
  const canSignIn = user?.role !== 'super_admin';
  const [locating, setLocating] = useState(false);

  // Admin sign-out modal state
  const [signOutTarget, setSignOutTarget] = useState<Attendance | null>(null);
  const [customTime, setCustomTime] = useState('');

  const { data: myAttendance, isLoading } = useQuery({
    queryKey: ['attendance-me'],
    queryFn: () => attendanceApi.me().then((r) => r.data.data),
    enabled: canSignIn,
  });

  const { data: allAttendance, isLoading: allLoading } = useQuery({
    queryKey: ['attendance-all'],
    queryFn: () => attendanceApi.list().then((r) => r.data.data),
    enabled: isAdmin,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data.data),
    enabled: isAdmin,
  });

  const signInMut = useMutation({
    mutationFn: ({ lat, lng }: { lat: number; lng: number }) => attendanceApi.signIn(lat, lng),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance-me'] }); toast.success('Signed in!'); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Sign in failed');
    },
  });

  const signOutMut = useMutation({
    mutationFn: attendanceApi.signOut,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance-me'] }); toast.success('Signed out!'); },
    onError: () => toast.error('Sign out failed'),
  });

  const adminSignOutMut = useMutation({
    mutationFn: ({ id, time }: { id: string; time?: string }) => attendanceApi.adminSignOut(id, time),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-all'] });
      setSignOutTarget(null);
      setCustomTime('');
      toast.success('Sign-out recorded');
    },
    onError: () => toast.error('Failed to sign out user'),
  });

  const handleSignIn = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); signInMut.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { setLocating(false); toast.error('Location access denied'); }
    );
  };

  const handleAdminSignOut = () => {
    if (!signOutTarget) return;
    adminSignOutMut.mutate({
      id: signOutTarget.id,
      time: customTime ? new Date(customTime).toISOString() : undefined,
    });
  };

  const getUserName = (id: string) => users?.find((u) => u.id === id)?.name ?? id;

  const today = myAttendance?.find((a) => a.date === localDate());

  if (isLoading || allLoading) return <PageSpinner />;

  const list = isAdmin ? allAttendance ?? [] : myAttendance ?? [];

  // Open records: signed in but no sign-out (admin view only)
  const openCount = isAdmin ? list.filter((a) => a.sign_in_at && !a.sign_out_at).length : 0;

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Track sign-in and sign-out records"
      />

      {/* Open records warning for admins */}
      {isAdmin && openCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 mb-5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle size={16} className="shrink-0 text-amber-500" />
          <span>
            <span className="font-semibold">{openCount} employee{openCount > 1 ? 's' : ''}</span> still signed in without a sign-out.
            Use the <span className="font-semibold">Sign Out</span> button to close their records manually.
          </span>
        </div>
      )}

      {/* Sign In/Out Panel */}
      {canSignIn && (
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-5 mb-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg mb-1">Today&apos;s Attendance</h3>
              <p className="text-indigo-200 text-sm">{new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              {today?.sign_in_at && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <LogIn size={14} className="text-green-300" />
                  <span className="text-green-300">Signed in at {formatDateTime(today.sign_in_at)}</span>
                </div>
              )}
              {today?.sign_out_at && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <LogOut size={14} className="text-orange-300" />
                  <span className="text-orange-300">Signed out at {formatDateTime(today.sign_out_at)}</span>
                  {today.auto_closed && (
                    <span className="text-xs bg-amber-400/30 text-amber-200 px-1.5 py-0.5 rounded-full">Auto-closed</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {!today?.sign_in_at && (
                <Button
                  onClick={handleSignIn}
                  loading={locating || signInMut.isPending}
                  className="bg-green-500 hover:bg-green-400 border-0 flex items-center gap-2"
                >
                  <MapPin size={16} /> Sign In
                </Button>
              )}
              {today?.sign_in_at && !today?.sign_out_at && (
                <Button
                  onClick={() => signOutMut.mutate()}
                  loading={signOutMut.isPending}
                  className="bg-orange-500 hover:bg-orange-400 border-0"
                >
                  <LogOut size={16} /> Sign Out
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Clock size={16} className="text-indigo-500" />
          <h3 className="font-semibold text-gray-900">Attendance Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {isAdmin && <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Employee</th>}
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Sign In</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Sign Out</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                {isAdmin && <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-400">No records found</td></tr>
              ) : (
                list.map((a) => {
                  const isOpen = !!a.sign_in_at && !a.sign_out_at;
                  return (
                    <tr key={a.id} className={`hover:bg-gray-50/50 ${isOpen && isAdmin ? 'bg-amber-50/40' : ''}`}>
                      {isAdmin && <td className="px-4 py-3 font-medium text-gray-900">{getUserName(a.user_id)}</td>}
                      <td className="px-4 py-3 text-gray-700">{formatDate(a.date)}</td>
                      <td className="px-4 py-3 text-gray-600">{a.sign_in_at ? formatDateTime(a.sign_in_at) : '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {a.sign_out_at ? (
                          <span className="flex items-center gap-1.5">
                            {formatDateTime(a.sign_out_at)}
                            {a.auto_closed && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                                Auto
                              </span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {a.sign_in_at && a.sign_out_at ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Complete</span>
                        ) : a.sign_in_at ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">In Office</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">Absent</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {isOpen && (
                            <button
                              onClick={() => { setSignOutTarget(a); setCustomTime(''); }}
                              className="text-xs font-medium text-orange-600 hover:text-orange-800 flex items-center gap-1"
                            >
                              <LogOut size={12} /> Sign Out
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin sign-out modal */}
      <Modal
        open={!!signOutTarget}
        onClose={() => { setSignOutTarget(null); setCustomTime(''); }}
        title="Sign Out Employee"
      >
        {signOutTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Manually closing attendance for <span className="font-semibold text-gray-900">{getUserName(signOutTarget.user_id)}</span> on <span className="font-semibold">{formatDate(signOutTarget.date)}</span>.
            </p>
            <Input
              label="Sign-out time (leave blank to use current time)"
              type="datetime-local"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
            />
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setSignOutTarget(null); setCustomTime(''); }}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                loading={adminSignOutMut.isPending}
                onClick={handleAdminSignOut}
              >
                <LogOut size={15} /> Confirm Sign Out
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
