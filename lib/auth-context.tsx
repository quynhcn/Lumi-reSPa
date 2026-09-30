'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, type Session, type User } from '@/lib/supabase';

export type UserRole = 'admin' | 'staff' | 'customer';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

/** Vai trò do server trả kèm phiên (đọc từ bảng profiles), không suy ra ở client. */
const roleOf = (s: Session | null): UserRole | null => (s ? s.user.app_metadata?.role ?? 'customer' : null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
      setLoading(false);
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role: roleOf(session), loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function getRedirectPath(role: UserRole | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/staff';
  return '/account';
}

/** Only allow same-origin relative paths (blocks open redirects like ?redirect=//evil.com). */
export function safeRedirect(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  return path;
}

/** Vai trò của tài khoản vừa đăng nhập (server đã trả kèm phiên). */
export async function fetchRole(_userId?: string): Promise<UserRole> {
  const { data } = await supabase.auth.getSession();
  return roleOf(data.session) ?? 'customer';
}
