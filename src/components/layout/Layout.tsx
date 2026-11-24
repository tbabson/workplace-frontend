import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { PageSpinner } from "../ui/Spinner";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/users": "Users",
  "/departments": "Departments",
  "/projects": "Projects",
  "/attendance": "Attendance",
  "/overtime": "Overtime",
  "/chat": "Chat",
  "/memos": "Memos",
  "/queries": "Queries",
  "/leaves": "Leave Management",
  "/reviews": "Performance Reviews",
  "/claims": "Expense Claims",
  "/assets": "Asset Management",
  "/reports": "Reports",
  "/profile": "My Profile",
};

export function Layout() {
  const { setUser } = useAuthStore();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    authApi.me()
      .then((r) => setUser(r.data.data))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [setUser]);

  // Close sidebar when navigating
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!ready) return <PageSpinner />;

  const baseRoute = "/" + (pathname.split("/")[1] ?? "");
  const title = PAGE_TITLES[baseRoute] ?? "WorkPlace";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar title={title} onMenuClick={() => setSidebarOpen((v) => !v)} />
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
