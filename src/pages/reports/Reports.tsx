import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Users, FolderKanban, UserCheck, CalendarOff, Clock } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  LineChart, Line,
} from 'recharts';
import { reportsApi, type AttendanceRow, type OvertimeRow } from '../../api/reports';
import type { DashboardStats } from '../../types';
import { PageHeader } from '../../components/shared/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { formatDateTime, localDate } from '../../utils/helpers';

// ── Colours ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B', active: '#10B981', on_hold: '#F97316',
  completed: '#6366F1', cancelled: '#EF4444',
};
const PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6'];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Local dates, not toISOString() (UTC), so the range matches the backend's "today".
const today     = localDate();
const monthAgo  = localDate(new Date(Date.now() - 30 * 24 * 3600 * 1000));
const weekAhead = localDate(new Date(Date.now() + 7 * 24 * 3600 * 1000));

function fmt(n?: number) { return (n ?? 0).toLocaleString(); }

function download(blob: BlobPart, name: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: string | number;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`h-11 w-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function Card({ title, children, action }: {
  title: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DateFilter({ from, to, onFrom, onTo }: {
  from: string; to: string;
  onFrom: (v: string) => void; onTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <label className="text-gray-500 text-xs font-medium">From</label>
        <input type="date" value={from} onChange={(e) => onFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-gray-500 text-xs font-medium">To</label>
        <input type="date" value={to} onChange={(e) => onTo(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
    </div>
  );
}

function Tabs({ tabs, active, onChange }: {
  tabs: string[]; active: string; onChange: (t: string) => void;
}) {
  return (
    <div className="overflow-x-auto mb-6">
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            active === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}>
          {t}
        </button>
      ))}
    </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Reports() {
  const [tab, setTab] = useState('Overview');
  const [attFrom, setAttFrom] = useState(monthAgo);
  const [attTo, setAttTo]     = useState(today);
  const [otFrom, setOtFrom]   = useState(monthAgo);
  const [otTo, setOtTo]       = useState(weekAhead);

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.dashboard().then((r) => r.data.data),
    refetchInterval: 60000,
  });

  const { data: attResp, isLoading: attLoading } = useQuery({
    queryKey: ['att-report', attFrom, attTo],
    queryFn: () => reportsApi.attendance(attFrom, attTo).then((r) => r.data.data),
    enabled: !!attFrom && !!attTo,
    refetchInterval: 30000,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const { data: otResp, isLoading: otLoading } = useQuery({
    queryKey: ['ot-report', otFrom, otTo],
    queryFn: () => reportsApi.overtime(otFrom, otTo).then((r) => r.data.data),
    enabled: !!otFrom && !!otTo,
    refetchInterval: 30000,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // ── Derived chart data ──────────────────────────────────────────────────────

  const attendance = useMemo((): AttendanceRow[] => attResp ?? [], [attResp]);
  const overtime   = useMemo((): OvertimeRow[]   => otResp  ?? [], [otResp]);

  const attendanceTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of attendance) map.set(r.date, (map.get(r.date) ?? 0) + 1);
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date: date.slice(5), count }));
  }, [attendance]);

  const hoursTrend = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of attendance) {
      if (r.hours_worked > 0) {
        if (!map.has(r.date)) map.set(r.date, []);
        map.get(r.date)!.push(r.hours_worked);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, hrs]) => ({
        date: date.slice(5),
        hours: parseFloat((hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(1)),
      }));
  }, [attendance]);

  const overtimeByPerson = useMemo(() => {
    const map = new Map<string, { name: string; hours: number }>();
    for (const r of overtime) {
      if (!map.has(r.user_id)) map.set(r.user_id, { name: r.user_name, hours: 0 });
      map.get(r.user_id)!.hours += r.overtime_hours;
    }
    return Array.from(map.values())
      .filter((v) => v.hours > 0)
      .sort((a, b) => b.hours - a.hours).slice(0, 10)
      .map((v) => ({ ...v, hours: parseFloat(v.hours.toFixed(1)) }));
  }, [overtime]);

  const overtimeTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of overtime) map.set(r.date, (map.get(r.date) ?? 0) + r.overtime_hours);
    return Array.from(map.entries())
      .filter(([, hours]) => hours > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, hours]) => ({ date: date.slice(5), hours: parseFloat(hours.toFixed(1)) }));
  }, [overtime]);

  const stats = (dashData ?? {}) as DashboardStats;

  const projectStatusData = (stats.projects_by_status ?? []).map((s) => ({
    name: s.name.replace('_', ' '),
    value: s.value,
  }));

  if (dashLoading) return <PageSpinner />;

  // ── Export handlers ─────────────────────────────────────────────────────────

  const exportAttendance = async () => {
    try {
      const res = await reportsApi.attendanceExport(attFrom, attTo);
      download(res.data, `attendance-${attFrom}-${attTo}.csv`);
    } catch { /* ignore */ }
  };

  const exportOvertime = async () => {
    try {
      const res = await reportsApi.overtimeExport(otFrom, otTo);
      download(res.data, `overtime-${otFrom}-${otTo}.csv`);
    } catch { /* ignore */ }
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle="Analytics, trends and exports" />

      <Tabs
        tabs={['Overview', 'Attendance', 'Overtime']}
        active={tab}
        onChange={setTab}
      />

      {/* ── OVERVIEW ─────────────────────────────────────────────────────────── */}
      {tab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Users"      value={fmt(stats.total_users)}       icon={Users}        color="text-blue-600"   bg="bg-blue-50" />
            <StatCard label="Active Projects"  value={fmt(stats.active_projects)}   icon={FolderKanban} color="text-indigo-600" bg="bg-indigo-50" />
            <StatCard label="Signed In Today"  value={fmt(stats.signed_in_today ?? stats.dept_signed_in_today)}  icon={UserCheck}    color="text-green-600"  bg="bg-green-50" />
            <StatCard label="Pending Leaves"   value={fmt(stats.pending_leaves ?? stats.dept_pending_leaves)}   icon={CalendarOff}  color="text-orange-600" bg="bg-orange-50" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Project Status Distribution">
              {projectStatusData.length === 0
                ? <p className="text-sm text-gray-400 text-center py-10">No project data.</p>
                : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={projectStatusData} dataKey="value" nameKey="name"
                           cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                        {projectStatusData.map((entry, i) => (
                          <Cell key={i} fill={STATUS_COLORS[entry.name.replace(' ', '_')] ?? PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [Number(v), 'Projects']} />
                      <Legend iconSize={10} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
            </Card>

            <Card title="Organisation Overview">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={[
                    { name: 'Users',       count: stats.total_users ?? 0 },
                    { name: 'Departments', count: stats.total_departments ?? 0 },
                    { name: 'Projects',    count: stats.total_projects ?? 0 },
                    { name: 'Leaves',      count: stats.pending_leaves ?? 0 },
                    { name: 'Claims',      count: stats.pending_claims ?? 0 },
                  ]}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Weekly Attendance Trend">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.weekly_attendance ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [Number(v), 'Sign-ins']} />
                  <Area type="monotone" dataKey="count" stroke="#6366F1" fill="url(#wkGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Monthly Attendance Trend">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.monthly_attendance ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [Number(v), 'Sign-ins']} />
                  <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={{ r: 4, fill: '#10B981' }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>
      )}

      {/* ── ATTENDANCE ───────────────────────────────────────────────────────── */}
      {tab === 'Attendance' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
            <DateFilter from={attFrom} to={attTo} onFrom={setAttFrom} onTo={setAttTo} />
            <button onClick={exportAttendance}
              className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors">
              <Download size={14} /> Export CSV
            </button>
          </div>

          {attLoading ? <PageSpinner /> : (
            <>
              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Daily Sign-ins">
                  {attendanceTrend.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-10">No data for selected range.</p>
                    : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={attendanceTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip formatter={(v) => [Number(v), 'Sign-ins']} />
                          <Bar dataKey="count" fill="#6366F1" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                </Card>

                <Card title="Average Hours Worked per Day">
                  {hoursTrend.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-10">No completed sign-outs in range.</p>
                    : (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={hoursTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 11 }} domain={[0, 12]} />
                          <Tooltip formatter={(v) => [`${v} hrs`, 'Avg hours']} />
                          <Area type="monotone" dataKey="hours" stroke="#10B981" fill="url(#hoursGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                </Card>
              </div>

              {/* Table */}
              <Card title={`Attendance Records (${attendance.length})`}>
                {attendance.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">No records</p>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="divide-y divide-gray-50 md:hidden">
                      {attendance.map((r) => {
                        const status = r.sign_in_at && r.sign_out_at ? 'Complete'
                          : r.sign_in_at ? 'In Office' : 'Absent';
                        const statusCls = r.sign_in_at && r.sign_out_at
                          ? 'bg-green-100 text-green-700'
                          : r.sign_in_at ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600';
                        return (
                          <div key={r.id} className="px-4 py-3">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-gray-900 text-sm">{r.user_name}</p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCls}`}>{status}</span>
                            </div>
                            <p className="text-xs text-gray-500 mb-1.5">{r.date}</p>
                            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                              <div>
                                <p className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">Sign In</p>
                                <p>{r.sign_in_at ? formatDateTime(r.sign_in_at as unknown as string) : '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">Sign Out</p>
                                <p>{r.sign_out_at ? formatDateTime(r.sign_out_at as unknown as string) : '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">Hours</p>
                                <p>{r.hours_worked > 0 ? `${r.hours_worked.toFixed(1)}h` : '—'}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            {['Employee', 'Date', 'Sign In', 'Sign Out', 'Hours', 'Status'].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {attendance.map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 font-medium text-gray-900">{r.user_name}</td>
                              <td className="px-4 py-2.5 text-gray-600">{r.date}</td>
                              <td className="px-4 py-2.5 text-gray-600">{r.sign_in_at ? formatDateTime(r.sign_in_at as unknown as string) : '—'}</td>
                              <td className="px-4 py-2.5 text-gray-600">{r.sign_out_at ? formatDateTime(r.sign_out_at as unknown as string) : '—'}</td>
                              <td className="px-4 py-2.5 text-gray-600">{r.hours_worked > 0 ? `${r.hours_worked.toFixed(1)}h` : '—'}</td>
                              <td className="px-4 py-2.5">
                                {r.sign_in_at && r.sign_out_at ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Complete</span>
                                ) : r.sign_in_at ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">In Office</span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Absent</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── OVERTIME ─────────────────────────────────────────────────────────── */}
      {tab === 'Overtime' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
            <DateFilter from={otFrom} to={otTo} onFrom={setOtFrom} onTo={setOtTo} />
            <button onClick={exportOvertime}
              className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors">
              <Download size={14} /> Export CSV
            </button>
          </div>

          {otLoading ? <PageSpinner /> : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Overtime Hours by Employee">
                  {overtimeByPerson.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-10">No overtime in selected range.</p>
                    : (
                      <ResponsiveContainer width="100%" height={Math.max(180, overtimeByPerson.length * 36)}>
                        <BarChart data={overtimeByPerson} layout="vertical"
                          margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                          <Tooltip formatter={(v) => [`${v}h`, 'Overtime']} />
                          <Bar dataKey="hours" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                </Card>

                <Card title="Daily Overtime Trend">
                  {overtimeTrend.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-10">No overtime in selected range.</p>
                    : (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={overtimeTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="otGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => [`${v}h`, 'Overtime hrs']} />
                          <Area type="monotone" dataKey="hours" stroke="#F59E0B" fill="url(#otGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                </Card>
              </div>

              {/* Table */}
              <Card title={`Overtime Records (${overtime.length})`}>
                {overtime.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">No records</p>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="divide-y divide-gray-50 md:hidden">
                      {overtime.map((r, i) => (
                        <div key={i} className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{r.user_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{r.date}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-sm">
                            <Clock size={13} />{r.overtime_hours.toFixed(1)}h
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            {['Employee', 'Date', 'Overtime Hours'].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {overtime.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 font-medium text-gray-900">{r.user_name}</td>
                              <td className="px-4 py-2.5 text-gray-600">{r.date}</td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                  <Clock size={13} />{r.overtime_hours.toFixed(1)}h
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
