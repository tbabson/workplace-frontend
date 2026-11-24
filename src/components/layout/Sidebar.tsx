import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  Clock,
  Timer,
  MessageSquare,
  FileText,
  HelpCircle,
  CalendarOff,
  Star,
  Receipt,
  Package,
  BarChart3,
  LogOut,
  Briefcase,
  X,
} from "lucide-react";
import { cn } from "../../utils/helpers";
import { useAuthStore } from "../../store/authStore";
import { authApi } from "../../api/auth";
import { Avatar } from "../ui/Avatar";

const navItems = [
  {
    to: "/",
    icon: LayoutDashboard,
    label: "Dashboard",
    roles: ["super_admin", "dept_head", "procurement", "staff"],
  },
  { to: "/users", icon: Users, label: "Staffs", roles: ["super_admin"] },
  {
    to: "/departments",
    icon: Building2,
    label: "Departments",
    roles: ["super_admin"],
  },
  {
    to: "/projects",
    icon: FolderKanban,
    label: "Projects",
    roles: ["super_admin", "dept_head", "procurement", "staff"],
  },
  {
    to: "/attendance",
    icon: Clock,
    label: "Attendance",
    roles: ["super_admin", "dept_head", "procurement", "staff"],
  },
  {
    to: "/overtime",
    icon: Timer,
    label: "Overtime",
    roles: ["super_admin", "dept_head", "procurement", "staff"],
  },
  {
    to: "/chat",
    icon: MessageSquare,
    label: "Chat",
    roles: ["super_admin", "dept_head", "procurement", "staff"],
  },
  {
    to: "/memos",
    icon: FileText,
    label: "Memos",
    roles: ["super_admin", "dept_head", "procurement", "staff"],
  },
  {
    to: "/queries",
    icon: HelpCircle,
    label: "Queries",
    roles: ["super_admin", "dept_head", "procurement", "staff"],
  },
  {
    to: "/leaves",
    icon: CalendarOff,
    label: "Leave",
    roles: ["super_admin", "dept_head", "procurement", "staff"],
  },
  {
    to: "/reviews",
    icon: Star,
    label: "Reviews",
    roles: ["super_admin", "dept_head", "procurement", "staff"],
  },
  {
    to: "/claims",
    icon: Receipt,
    label: "Claims",
    roles: ["super_admin", "dept_head", "procurement", "staff"],
  },
  {
    to: "/assets",
    icon: Package,
    label: "Assets",
    // Staff see only assets assigned to them (read-only).
    roles: ["super_admin", "dept_head", "procurement", "staff"],
  },
  {
    to: "/reports",
    icon: BarChart3,
    label: "Reports",
    roles: ["super_admin", "dept_head", "procurement"],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    logout();
  };

  const role = (user?.role ?? '').toLowerCase().trim();
  const filtered = navItems.filter((item) =>
    role ? item.roles.includes(role) : false,
  );

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
          <Briefcase className="h-5 w-5 text-white" />
        </div>
        <span className="text-white font-bold text-lg">WorkPlace</span>
        <button
          onClick={onClose}
          className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors lg:hidden"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {filtered.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800",
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      {user && (
        <div className="px-3 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <NavLink to="/profile" onClick={onClose} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
              <Avatar name={user.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-400 truncate capitalize">
                  {user.role.replace(/_/g, " ")}
                </p>
              </div>
            </NavLink>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
