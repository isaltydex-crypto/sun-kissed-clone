import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useAdminAuth } from "@/context/AdminAuthContext";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { isAuthenticated } = useAdminAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Login page is always accessible
  if (pathname === "/admin/login") return <Outlet />;

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" search={{ redirect: pathname }} />;
  }
  return <Outlet />;
}
