import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  Users, FolderKanban, Building2, CalendarOff, Receipt,
  Clock, CheckCircle, Briefcase, ClipboardList, UserCheck, Package,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import { reportsApi } from '../../api/reports';
import { useAuthStore } from '../../store/authStore';
import { PageSpinner } from '../../components/ui/Spinner';
import type { DashboardStats, User } from '../../types';

// ── Colours ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:   '#F59E0B',
  active:    '#10B981',
  on_hold:   '#F97316',
  completed: '#6366F1',
  cancelled: '#EF4444',
};
const CHART_BLUE   = '#6366F1';
const CHART_GREEN  = '#10B981';
const CHART_TEAL   = '#14B8A6';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmt(n?: number) { return n ?? 0; }

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, bg, sub,
}: {
  label: string; value: number | string;
  icon: React.ElementType; color: string; bg: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ProgressBar({ title, progress, status }: { title: string; progress: number; status: string }) {
  const color = status === 'active' ? 'bg-indigo-500' : status === 'on_hold' ? 'bg-orange-400' : 'bg-gray-400';
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-700 truncate max-w-[70%]">{title}</span>
        <span className="text-xs font-medium text-gray-500 ml-2">{progress}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function AttendeeList({ attendees }: { attendees: DashboardStats['today_attendees'] }) {
  if (!attendees?.length) {
    return <p className="text-sm text-gray-400 text-center py-6">No one signed in yet today.</p>;
  }
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {attendees.map((a, i) => (
        <div key={i} className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600">
              {a.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{a.name}</p>
              <p className="text-xs text-gray-400">{a.position || a.department || '—'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{a.sign_in_at}</p>
            <span className={`text-xs font-medium ${a.signed_out ? 'text-gray-400' : 'text-green-600'}`}>
              {a.signed_out ? 'Left' : '● In Office'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Role views ────────────────────────────────────────────────────────────────

function AdminView({ stats }: { stats: DashboardStats }) {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users"       value={fmt(stats.total_users)}       icon={Users}        color="text-blue-600"   bg="bg-blue-50" />
        <StatCard label="Active Projects"   value={fmt(stats.active_projects)}   icon={FolderKanban} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard label="Signed In Today"   value={fmt(stats.signed_in_today)}   icon={UserCheck}    color="text-green-600"  bg="bg-green-50" />
        <StatCard label="Pending Leaves"    value={fmt(stats.pending_leaves)}    icon={CalendarOff}  color="text-orange-600" bg="bg-orange-50" />
        <StatCard label="Departments"       value={fmt(stats.total_departments)} icon={Building2}    color="text-purple-600" bg="bg-purple-50" />
        <StatCard label="Completed Projects"value={fmt(stats.completed_projects)}icon={CheckCircle}  color="text-teal-600"   bg="bg-teal-50" />
        <StatCard label="Pending Claims"    value={fmt(stats.pending_claims)}    icon={Receipt}      color="text-rose-600"   bg="bg-rose-50" />
        <StatCard label="Assigned Assets"   value={fmt(stats.assigned_assets)}   icon={Package}      color="text-gray-600"   bg="bg-gray-100" sub={`of ${fmt(stats.total_assets)} total`} />
      </div>

      {/* Row 2: Donut + Weekly Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Projects by Status">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.projects_by_status ?? []} dataKey="value" nameKey="name"
                   cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {(stats.projects_by_status ?? []).map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.name] ?? '#94A3B8'} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [Number(v), 'Projects']} />
              <Legend formatter={(v) => v.replace('_', ' ')} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Attendance This Week">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.weekly_attendance ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [Number(v), 'Sign-ins']} />
              <Bar dataKey="count" fill={CHART_BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3: Monthly trend (area) + Project progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Monthly Attendance Trend">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.monthly_attendance ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_TEAL} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_TEAL} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [Number(v), 'Sign-ins']} />
              <Area type="monotone" dataKey="count" stroke={CHART_TEAL} fill="url(#attendGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Project Progress">
          <div className="pt-1">
            {(stats.project_progress ?? []).length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">No active projects.</p>
              : (stats.project_progress ?? []).map((p, i) => (
                  <ProgressBar key={i} title={p.title} progress={p.progress} status={p.status} />
                ))}
          </div>
        </ChartCard>
      </div>

      {/* Row 4: Today's attendees */}
      <ChartCard title={`Today's Attendance — ${fmt(stats.signed_in_today)} signed in`}>
        <AttendeeList attendees={stats.today_attendees} />
      </ChartCard>
    </div>
  );
}

function DeptHeadView({ stats }: { stats: DashboardStats }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Dept Members"      value={fmt(stats.dept_members)}         icon={Users}        color="text-blue-600"   bg="bg-blue-50" />
        <StatCard label="Active Projects"   value={fmt(stats.dept_active_projects)} icon={FolderKanban} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard label="Signed In Today"   value={fmt(stats.dept_signed_in_today)} icon={UserCheck}    color="text-green-600"  bg="bg-green-50" />
        <StatCard label="Pending Leaves"    value={fmt(stats.dept_pending_leaves)}  icon={CalendarOff}  color="text-orange-600" bg="bg-orange-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Projects by Status">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.projects_by_status ?? []} dataKey="value" nameKey="name"
                   cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {(stats.projects_by_status ?? []).map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.name] ?? '#94A3B8'} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [Number(v), 'Projects']} />
              <Legend formatter={(v) => v.replace('_', ' ')} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Dept Attendance This Week">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.weekly_attendance ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [Number(v), 'Sign-ins']} />
              <Bar dataKey="count" fill={CHART_GREEN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Monthly Attendance Trend">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.monthly_attendance ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="deptGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_GREEN} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [Number(v), 'Sign-ins']} />
              <Area type="monotone" dataKey="count" stroke={CHART_GREEN} fill="url(#deptGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Project Progress">
          <div className="pt-1">
            {(stats.project_progress ?? []).length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">No active projects.</p>
              : (stats.project_progress ?? []).map((p, i) => (
                  <ProgressBar key={i} title={p.title} progress={p.progress} status={p.status} />
                ))}
          </div>
        </ChartCard>
      </div>

      <ChartCard title={`Today's Attendance — ${fmt(stats.dept_signed_in_today)} signed in`}>
        <AttendeeList attendees={stats.today_attendees} />
      </ChartCard>
    </div>
  );
}

function StaffView({ stats, user }: { stats: DashboardStats; user: User | null }) {
  const attendanceData = stats.personal_weekly_attendance ?? [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Projects"      value={fmt(stats.my_projects)}       icon={FolderKanban}   color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard label="Pending Tasks"    value={fmt(stats.my_pending_tasks)}  icon={ClipboardList}  color="text-orange-600" bg="bg-orange-50" />
        <StatCard label="Leave Requests"   value={fmt(stats.my_pending_leaves)} icon={CalendarOff}    color="text-yellow-600" bg="bg-yellow-50" />
        <StatCard label="Pending Claims"   value={fmt(stats.my_pending_claims)} icon={Receipt}        color="text-rose-600"   bg="bg-rose-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="My Attendance This Week">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attendanceData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} ticks={[0, 1]} tickFormatter={(v) => v === 1 ? 'In' : 'Out'} />
              <Tooltip formatter={(v) => [Number(v) === 1 ? 'Present' : 'Absent', '']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}
                fill={CHART_BLUE}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="My Assigned Projects">
          <div className="pt-1">
            {(stats.project_progress ?? []).length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">No active projects assigned.</p>
              : (stats.project_progress ?? []).map((p, i) => (
                  <ProgressBar key={i} title={p.title} progress={p.progress} status={p.status} />
                ))}
          </div>
        </ChartCard>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-4">My Profile</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Name',       val: user?.name },
            { label: 'Email',      val: user?.email },
            { label: 'Role',       val: user?.role?.replace(/_/g, ' ') },
            { label: 'Department', val: user?.department_name ?? 'N/A' },
            { label: 'Position',   val: user?.position ?? 'N/A' },
          ].map(({ label, val }) => (
            <div key={label}>
              <p className="text-gray-400 text-xs mb-0.5">{label}</p>
              <p className="font-medium text-gray-900 capitalize">{val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.dashboard().then((r) => r.data.data),
    refetchInterval: 30000, // real-time: refresh every 30 s
  });

  // Also refresh when a new notification arrives via WebSocket (sign-in events)
  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: ['dashboard'] });
    window.addEventListener('workplace:attendance', handler);
    return () => window.removeEventListener('workplace:attendance', handler);
  }, [qc]);

  if (isLoading) return <PageSpinner />;

  const stats = (data ?? {}) as DashboardStats;
  const role = user?.role;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Live overview — refreshes every 30 seconds.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>
      </div>

      {role === 'super_admin' && <AdminView stats={stats} />}
      {role === 'dept_head'   && <DeptHeadView stats={stats} />}
      {(role === 'staff' || role === 'procurement') && <StaffView stats={stats} user={user} />}
    </div>
  );
}
