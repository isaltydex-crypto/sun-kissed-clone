import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AdminAuthValue = {
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthValue | null>(null);
const STORAGE_KEY = "peptivalab.admin.v1";
const PASSWORD_KEY = "peptivalab.admin.pw.v1";

// Demo password — change this in src/context/AdminAuthContext.tsx
// (also set ADMIN_CHAT_PASSWORD in server env to the same value for the chat backend)
const ADMIN_PASSWORD = "peptiva-admin-2026";

export function getAdminPassword(): string {
  try {
    return sessionStorage.getItem(PASSWORD_KEY) || "";
  } catch {
    return "";
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") {
        setIsAuthenticated(true);
        const pw = sessionStorage.getItem(PASSWORD_KEY) || "";
        if (pw) {
          document.cookie = `pvl_admin=${encodeURIComponent(pw)}; path=/; SameSite=Lax; max-age=43200`;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const login = (password: string) => {
    if (password === ADMIN_PASSWORD) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
        sessionStorage.setItem(PASSWORD_KEY, password);
        // Cookie so server functions can authorize admin RPC calls.
        document.cookie = `pvl_admin=${encodeURIComponent(password)}; path=/; SameSite=Lax; max-age=43200`;
      } catch {
        // ignore
      }
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(PASSWORD_KEY);
      document.cookie = "pvl_admin=; path=/; max-age=0";
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
  };


  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
