import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { adminLogin, adminLogout, adminSessionStatus } from "@/lib/admin-auth.functions";

type AdminAuthValue = {
  isAuthenticated: boolean;
  ready: boolean;
  login: (password: string, code?: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);
  const authVersionRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const requestVersion = authVersionRef.current;
    adminSessionStatus()
      .then((s) => {
        if (mounted && requestVersion === authVersionRef.current) setIsAuthenticated(s.authenticated);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const login: AdminAuthValue["login"] = async (password, code) => {
    try {
      await adminLogin({ data: { password, code } });
      authVersionRef.current += 1;
      setIsAuthenticated(true);
      setReady(true);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Inloggning misslyckades." };
    }
  };

  const logout = async () => {
    try {
      await adminLogout();
    } catch {
      // ignore
    }
    authVersionRef.current += 1;
    setIsAuthenticated(false);
    setReady(true);
  };

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, ready, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
