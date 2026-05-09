import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useAdminAuth } from "@/context/AdminAuthContext";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { isAuthenticated, ready } = useAdminAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname === "/admin/login") return <Outlet />;

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Laddar...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" search={{ redirect: pathname }} />;
  }
  return <Outlet />;
}
