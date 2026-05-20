/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { Profile, GuestSession } from './types';
import { createGuestSession } from './api';

interface AuthState {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  guest: GuestSession | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  startGuestSession: (username: string) => Promise<GuestSession>;
}

const AuthContext = createContext<AuthState | null>(null);

function loadGuestSession(): GuestSession | null {
  try {
    const raw = localStorage.getItem('anachron_guest');
    if (!raw) return null;
    return JSON.parse(raw) as GuestSession;
  } catch {
    return null;
  }
}

function saveGuestSession(session: GuestSession) {
  localStorage.setItem('anachron_guest', JSON.stringify(session));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [guest, setGuest] = useState<GuestSession | null>(loadGuestSession);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchProfile(userId: string) {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      setProfile(data as Profile);
    } else if (error && error.code !== 'PGRST116') {
      console.warn('fetchProfile error:', error);
    } else {
      // Profile doesn't exist — create it from auth metadata
      const { data: authUser } = await supabase.auth.getUser();
      const email = authUser?.user?.email || 'user';
      const baseName = email.split('@')[0];
      // Try base name + uuid suffix first; if conflict, fall back to uuid-only
      const { data: newProfile, error: insertErr } = await supabase
        .from('profiles')
        .insert({ id: userId, username: baseName + '_' + userId.slice(0, 6), bio: '', is_ai_character: false, is_admin: false })
        .select('*')
        .single();
      if (newProfile) {
        setProfile(newProfile as Profile);
      } else if (insertErr) {
        // Conflict — retry with full UUID as username
        const { data: fallback } = await supabase
          .from('profiles')
          .insert({ id: userId, username: '用户_' + userId.slice(0, 8), bio: '', is_ai_character: false, is_admin: false })
          .select('*')
          .single();
        if (fallback) setProfile(fallback as Profile);
      }
    }
  }

  useEffect(() => {
    if (!supabase) {
      setTimeout(() => setIsLoading(false), 0);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! });
        fetchProfile(session.user.id);
      }
      setTimeout(() => setIsLoading(false), 0);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! });
        fetchProfile(session.user.id);
        setGuest(null);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    if (!supabase) return { error: 'Supabase 未配置' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message?.includes('Invalid login credentials')) {
        return { error: '邮箱或密码错误，请检查后重试' };
      }
      if (error.message?.includes('Email not confirmed')) {
        return { error: '邮箱尚未验证，请先点击确认邮件中的链接' };
      }
      return { error: error.message };
    }
    return {};
  }

  async function register(email: string, password: string) {
    if (!supabase) return { error: 'Supabase 未配置' };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        return { error: '该邮箱已被注册，请直接登录或使用其他邮箱' };
      }
      if (error.message?.includes('Password should be at least 6 characters')) {
        return { error: '密码至少 6 位' };
      }
      return { error: '注册失败: ' + error.message };
    }
    // Supabase returns user=null for unconfirmed duplicate emails
    // user exists + session is null => email confirmation required
    // no user at all => duplicate email (Supabase hides this for security)
    if (!data.user) {
      return { error: '该邮箱已被注册，请直接登录或使用其他邮箱' };
    }
    if (!data.session) {
      // User created successfully, but email confirmation is required
      return { error: '注册成功！请查收邮件并点击确认链接以完成注册。' };
    }
    return {};
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function startGuestSession(username: string): Promise<GuestSession> {
    const session = await createGuestSession(username);
    saveGuestSession(session);
    setGuest(session);
    return session;
  }



  return (
    <AuthContext.Provider value={{
      user,
      profile,
      guest,
      isLoading,
      isGuest: !!guest,
      login,
      register,
      logout,
      startGuestSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
