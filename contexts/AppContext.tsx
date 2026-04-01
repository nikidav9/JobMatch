import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { User, Vacancy, Like, Chat } from '@/constants/types';
import { getSessionUser, saveSessionUser, clearSessionUser } from '@/services/storage';
import {
  dbGetUsers, dbUpsertUser,
  dbGetVacancies,
  dbGetLikes,
  dbGetChats,
  dbGetSaved,
} from '@/services/db';

interface ToastData { message: string; type: 'success' | 'error' | 'match' }

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (u: User | null) => void;
  users: User[];
  refreshUsers: () => Promise<void>;
  vacancies: Vacancy[];
  setVacancies: (arr: Vacancy[]) => void;
  refreshVacancies: () => Promise<void>;
  likes: Like[];
  setLikes: (arr: Like[]) => void;
  refreshLikes: () => Promise<void>;
  chats: Chat[];
  refreshChats: (user?: User | null) => Promise<void>;
  savedIds: string[];
  setSavedIds: (ids: string[]) => void;
  refreshSaved: (user?: User | null) => Promise<void>;
  optimisticAddSaved: (vacancyId: string) => void;
  optimisticRemoveSaved: (vacancyId: string) => void;
  optimisticUpdateLike: (vacancyId: string, workerId: string, patch: Partial<import('@/constants/types').Like>) => void;
  toast: ToastData | null;
  showToast: (message: string, type?: 'success' | 'error' | 'match') => void;
  refreshAll: (user?: User | null) => Promise<void>;
  logout: () => Promise<void>;
  unreadCount: number;
  loading: boolean;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [currentUser, _setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [loading, setLoading] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Session ──────────────────────────────────────────────────────────────

  const setCurrentUser = (u: User | null) => {
    if (u) {
      _setCurrentUser(u);
      // Save session and refresh in background — don't block caller
      saveSessionUser(u).catch(() => {});
      Promise.all([
        refreshUsers(),
        refreshVacancies(),
        refreshLikes(),
        refreshChats(u),
        refreshSaved(u),
      ]).catch(() => {});
    } else {
      // Synchronously clear all state — triggers immediate re-render and navigation
      _setCurrentUser(null);
      setChats([]);
      setSavedIds([]);
      setLikes([]);
      setVacancies([]);
      clearSessionUser().catch(() => {});
    }
  };

  const logout = async () => {
    console.log('logout start');
    // CRITICAL: setCurrentUser(null) clears state SYNCHRONOUSLY
    setCurrentUser(null);
    setLoading(false);
    console.log('setCurrentUser(null) done');
    // Async cleanup happens in background (don't block logout flow)
    try {
      await clearSessionUser();
      console.log('clearSessionUser done');
    } catch (error) {
      console.warn('[AppContext] clearSessionUser failed during logout', error);
    }
  };

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const refreshUsers = async () => {
    const data = await dbGetUsers();
    setUsers(data);
  };

  const refreshVacancies = async () => {
    const data = await dbGetVacancies();
    setVacancies(data);
  };

  const refreshLikes = async () => {
    const data = await dbGetLikes();
    setLikes(data);
  };

  const refreshChats = async (user?: User | null) => {
    const u = user ?? currentUser;
    if (!u) return;
    const data = await dbGetChats(u.id, u.role);
    setChats(data);
  };

  const refreshSaved = async (user?: User | null) => {
    const u = user ?? currentUser;
    if (!u) return;
    const data = await dbGetSaved(u.id);
    setSavedIds(data);
  };

  const refreshAll = async (user?: User | null) => {
    const u = user ?? currentUser;
    await Promise.all([
      refreshUsers(),
      refreshVacancies(),
      refreshLikes(),
      ...(u ? [refreshChats(u), refreshSaved(u)] : []),
    ]);
  };

  // Optimistic helpers — update local state immediately without server round-trip
  const optimisticAddSaved = (vacancyId: string) => {
    setSavedIds(prev => prev.includes(vacancyId) ? prev : [...prev, vacancyId]);
  };
  const optimisticRemoveSaved = (vacancyId: string) => {
    setSavedIds(prev => prev.filter(id => id !== vacancyId));
  };
  const optimisticUpdateLike = (vacancyId: string, workerId: string, patch: Partial<Like>) => {
    setLikes(prev => {
      const idx = prev.findIndex(l => l.vacancyId === vacancyId && l.workerId === workerId);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], ...patch };
      return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
    });
  };

  // ── Boot ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const session = await getSessionUser();
        if (session) _setCurrentUser(session);
        await Promise.all([
          refreshUsers(),
          refreshVacancies(),
          refreshLikes(),
          ...(session ? [refreshChats(session), refreshSaved(session)] : []),
        ]);
      } catch (e) {
        console.warn('[AppContext] boot error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/');
    }
  }, [currentUser, loading, router]);

  // ── Auto-cleanup: delete vacancies with no applicants 5 min before shift start ──

  const cleanupStaleVacancies = async () => {
    try {
      const { data } = await getSupabaseClient()
        .from('jm_vacancies')
        .select('id, date, time_start')
        .eq('status', 'open');
      if (!data) return;

      const now = new Date();
      const toDelete: string[] = [];

      for (const v of data) {
        if (!v.date || !v.time_start) continue;
        const [h, m] = (v.time_start as string).split(':').map(Number);
        const shiftStart = new Date(`${v.date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
        const diffMs = shiftStart.getTime() - now.getTime();
        // Delete if 5 min or less remain before shift start
        if (diffMs <= 5 * 60 * 1000 && diffMs > -60 * 60 * 1000) {
          // Check if any worker liked this vacancy
          const { data: likeRows } = await getSupabaseClient()
            .from('jm_likes')
            .select('id')
            .eq('vacancy_id', v.id)
            .eq('worker_liked', true)
            .limit(1);
          if (!likeRows || likeRows.length === 0) {
            toDelete.push(v.id);
          }
        }
      }

      for (const id of toDelete) {
        await getSupabaseClient().from('jm_vacancies').delete().eq('id', id);
        console.log('[AppContext] auto-deleted stale vacancy', id);
      }

      if (toDelete.length > 0) {
        await refreshVacancies();
      }
    } catch (e) {
      console.warn('[AppContext] cleanupStaleVacancies error', e);
    }
  };

  // ── Background poll (every 15s) when user is logged in ───────────────────

  useEffect(() => {
    if (!currentUser) return;
    // Run cleanup immediately and then on each poll
    cleanupStaleVacancies();
    const interval = setInterval(() => {
      refreshVacancies();
      refreshLikes();
      refreshChats(currentUser);
      refreshSaved(currentUser);
      cleanupStaleVacancies();
    }, 15_000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = (message: string, type: 'success' | 'error' | 'match' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  // ── Derived: unread count ─────────────────────────────────────────────────

  const unreadCount = currentUser
    ? chats
        .filter(c =>
          currentUser.role === 'worker'
            ? c.workerId === currentUser.id && c.unreadWorker > 0
            : c.employerId === currentUser.id && c.unreadEmployer > 0
        )
        .reduce(
          (sum, c) => sum + (currentUser.role === 'worker' ? c.unreadWorker : c.unreadEmployer),
          0
        )
    : 0;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        refreshUsers,
        vacancies,
        setVacancies,
        refreshVacancies,
        likes,
        setLikes,
        refreshLikes,
        chats,
        refreshChats,
        savedIds,
        setSavedIds,
        refreshSaved,
        optimisticAddSaved,
        optimisticRemoveSaved,
        optimisticUpdateLike,
        toast,
        showToast,
        refreshAll,
        logout,
        unreadCount,
        loading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
