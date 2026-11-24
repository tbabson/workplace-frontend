import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { User, Building2, Briefcase, Mail, ShieldCheck } from 'lucide-react';
import { usersApi } from '../../api/users';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import type { User as UserType } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/shared/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { apiError } from '../../utils/helpers';
import toast from 'react-hot-toast';

interface ProfileForm {
  name: string;
  email: string;
  position: string;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'dept_head';

  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, watch, formState: { isSubmitting: isPwdSubmitting } } = useForm<PasswordForm>();

  const pwdMut = useMutation({
    mutationFn: (d: PasswordForm) => usersApi.changePassword(d.current_password, d.new_password),
    onSuccess: () => {
      resetPwd();
      toast.success('Password changed');
    },
    onError: (e) => toast.error(apiError(e, 'Failed to change password')),
  });

  const onPasswordSubmit = (d: PasswordForm) => {
    if (d.new_password !== d.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    pwdMut.mutate(d);
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl">
      <PageHeader title="My Profile" subtitle="Your account information" />

      <div className="space-y-6">
        {/* Profile info — read-only */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar name={user.name} size="lg" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
              <p className="text-sm text-indigo-600 font-medium capitalize">{user.role.replace(/_/g, ' ')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <InfoRow icon={Mail} label="Email" value={user.email} />
            <InfoRow icon={Briefcase} label="Position" value={user.position} />
            <InfoRow icon={Building2} label="Department" value={user.department_name} />
            <InfoRow icon={ShieldCheck} label="Role" value={user.role.replace(/_/g, ' ')} capitalize />
          </div>

          {!isAdmin && (
            <p className="mt-4 text-xs text-gray-400 text-center">
              Contact your administrator to update your profile information.
            </p>
          )}
        </div>

        {/* Edit form — admins only */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User size={16} /> Edit Profile
            </h3>
            <AdminProfileForm user={user} setUser={setUser} />
          </div>
        )}

        {/* Change password — all roles */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Change Password</h3>
          <form onSubmit={handlePwd(onPasswordSubmit)} className="space-y-4">
            <Input label="Current Password" type="password" autoComplete="current-password" {...regPwd('current_password', { required: true })} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="New Password" type="password" {...regPwd('new_password', { required: true, minLength: 8 })} autoComplete="new-password" placeholder="At least 8 characters" />
              <Input label="Confirm New Password" type="password" {...regPwd('confirm_password', {
                required: true,
                validate: (v) => v === watch('new_password') || 'Passwords do not match',
              })} />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={isPwdSubmitting || pwdMut.isPending}>
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, capitalize }: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <Icon size={16} className="text-gray-400 shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-sm font-medium text-gray-900 ${capitalize ? 'capitalize' : ''}`}>
          {value ?? '—'}
        </p>
      </div>
    </div>
  );
}

function AdminProfileForm({ user, setUser }: { user: UserType; setUser: (u: UserType) => void }) {
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ProfileForm>();

  useEffect(() => {
    reset({ name: user.name, email: user.email, position: user.position ?? '' });
  }, [user, reset]);

  const updateMut = useMutation({
    mutationFn: (d: ProfileForm) => usersApi.updateMe(d),
    onSuccess: async () => {
      const fresh = await authApi.me();
      setUser(fresh.data.data);
      toast.success('Profile updated');
    },
    onError: (e) => toast.error(apiError(e, 'Failed to update profile')),
  });

  return (
    <form onSubmit={handleSubmit((d) => updateMut.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Full Name" {...register('name', { required: true })} />
        <Input label="Email" type="email" {...register('email', { required: true })} />
      </div>
      <Input label="Position / Job Title" placeholder="e.g. Software Engineer" {...register('position')} />
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={isSubmitting || updateMut.isPending}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
