import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { Profile, GuestSession } from './types';

interface AuthState {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  guest: GuestSession | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string, username: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  startGuestSession: (username: string) => void;
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

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! });
        fetchProfile(session.user.id);
      }
      setIsLoading(false);
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

  async function fetchProfile(userId: string) {
    if (!supabase) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as Profile);
  }

  async function login(email: string, password: string) {
    if (!supabase) return { error: 'Supabase 未配置' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }

  async function register(email: string, password: string, username: string) {
    if (!supabase) return { error: 'Supabase 未配置' };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        username,
        bio: '',
        is_ai_character: false,
        is_admin: false,
      });
    }
    return {};
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  function startGuestSession(username: string) {
    const session: GuestSession = {
      id: crypto.randomUUID(),
      username,
      session_token: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    saveGuestSession(session);
    setGuest(session);
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
