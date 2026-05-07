import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import { User, Vacancy, Like, Chat, PermVacancy, PermApplication } from '@/constants/types';
import { getSessionUser, saveSessionUser, clearSessionUser, getVirtualStartDate, getTodayDates } from '@/services/storage';
import { registerPushToken } from '@/services/notifications';
import {
  dbGetUsers, dbUpsertUser,
  dbGetVacancies,
  dbGetLikes,
  dbGetChats,
  dbGetSaved,
  dbGetPermVacancies,
  dbGetPermVacanciesByEmployer,
  dbGetPermApplications,
  dbGetPermSaved,
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
  refreshLikes: (user?: User | null) => Promise<void>;
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
  // ── Permanent jobs ──
  permVacancies: PermVacancy[];
  refreshPermVacancies: (user?: User | null) => Promise<void>;
  permApplications: PermApplication[];
  refreshPermApplications: (user?: User | null) => Promise<void>;
  permSavedIds: string[];
  refreshPermSaved: (user?: User | null) => Promise<void>;
  optimisticAddPermSaved: (id: string) => void;
  optimisticRemovePermSaved: (id: string) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, _setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null);
  // ── FIX: start as true, only set false after boot completes ──
  const [loading, setLoading] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard to prevent concurrent boots
  const bootDone = useRef(false);

  // Permanent jobs state
  const [permVacancies, setPermVacancies] = useState<PermVacancy[]>([]);
  const [permApplications, setPermApplications] = useState<PermApplication[]>([]);
  const [permSavedIds, setPermSavedIds] = useState<string[]>([]);

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const refreshUsers = async () => {
    try {
      const data = await dbGetUsers();
      setUsers(data);
      _setCurrentUser(prev => {
        if (!prev) return prev;
        const fresh = data.find(u => u.id === prev.id);
        return fresh ?? prev;
      });
    } catch (e) {
      console.warn('[AppContext] refreshUsers error', e);
    }
  };

  const refreshVacancies = async () => {
    try {
      const data = await dbGetVacancies();
      setVacancies(data);
    } catch (e) {
      console.warn('[AppContext] refreshVacancies error', e);
    }
  };

  const refreshLikes = async (user?: User | null) => {
    try {
      const u = user ?? currentUser;
      const data = await dbGetLikes(u?.id, u?.role);
      setLikes(data);
    } catch (e) {
      console.warn('[AppContext] refreshLikes error', e);
    }
  };

  const refreshChats = async (user?: User | null) => {
    try {
      const u = user ?? currentUser;
      if (!u) return;
      const data = await dbGetChats(u.id, u.role);
      setChats(data);
    } catch (e) {
      console.warn('[AppContext] refreshChats error', e);
    }
  };

  const refreshSaved = async (user?: User | null) => {
    try {
      const u = user ?? currentUser;
      if (!u) return;
      const data = await dbGetSaved(u.id);
      setSavedIds(data);
    } catch (e) {
      console.warn('[AppContext] refreshSaved error', e);
    }
  };

  // ── Permanent job helpers ─────────────────────────────────────────────────

  const refreshPermVacancies = async (user?: User | null) => {
    try {
      const u = user ?? currentUser;
      if (!u) return;
      if (u.role === 'employer') {
        const data = await dbGetPermVacanciesByEmployer(u.id);
        setPermVacancies(data);
      } else {
        const data = await dbGetPermVacancies();
        setPermVacancies(data);
      }
    } catch (e) {
      console.warn('[AppContext] refreshPermVacancies error', e);
    }
  };

  const refreshPermApplications = async (user?: User | null) => {
    try {
      const u = user ?? currentUser;
      if (!u) return;
      const data = await dbGetPermApplications(u.id, u.role);
      setPermApplications(data);
    } catch (e) {
      console.warn('[AppContext] refreshPermApplications error', e);
    }
  };

  const refreshPermSaved = async (user?: User | null) => {
    try {
      const u = user ?? currentUser;
      if (!u) return;
      const data = await dbGetPermSaved(u.id);
      setPermSavedIds(data);
    } catch (e) {
      console.warn('[AppContext] refreshPermSaved error', e);
    }
  };

  const optimisticAddPermSaved = (id: string) => setPermSavedIds(prev => prev.includes(id) ? prev : [...prev, id]);
  const optimisticRemovePermSaved = (id: string) => setPermSavedIds(prev => prev.filter(x => x !== id));

  const refreshAll = async (user?: User | null) => {
    const u = user ?? currentUser;
    await Promise.all([
      refreshUsers(),
      refreshVacancies(),
      refreshLikes(u),
      ...(u ? [refreshChats(u), refreshSaved(u), refreshPermVacancies(u), refreshPermApplications(u), refreshPermSaved(u)] : []),
    ]);
  };

  const optimisticAddSaved = (vacancyId: string) =>
    setSavedIds(prev => prev.includes(vacancyId) ? prev : [...prev, vacancyId]);

  const optimisticRemoveSaved = (vacancyId: string) =>
    setSavedIds(prev => prev.filter(id => id !== vacancyId));

  const optimisticUpdateLike = (vacancyId: string, workerId: string, patch: Partial<Like>) => {
    setLikes(prev => {
      const idx = prev.findIndex(l => l.vacancyId === vacancyId && l.workerId === workerId);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], ...patch };
      return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
    });
  };

  // ── Session ──────────────────────────────────────────────────────────────

  /**
   * FIX: setCurrentUser теперь НЕ вызывает refresh* при логине.
   * Обновление данных происходит только через refreshAll, вызываемый
   * из экрана регистрации/логина ПОСЛЕ setCurrentUser.
   * Это устраняет гонку запросов и зависание loading.
   */
  const setCurrentUser = (u: User | null) => {
    if (u) {
      _setCurrentUser(u);
      saveSessionUser(u).catch(() => {});
      registerPushToken(u.id).catch(() => {});
    } else {
      _setCurrentUser(null);
      setChats([]);
      setSavedIds([]);
      setLikes([]);
      setVacancies([]);
      setPermVacancies([]);
      setPermApplications([]);
      setPermSavedIds([]);
      clearSessionUser().catch(() => {});
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    setLoading(false);
    try {
      await clearSessionUser();
    } catch (error) {
      console.warn('[AppContext] clearSessionUser failed during logout', error);
    }
  };

  // ── Boot ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (bootDone.current) return;
    bootDone.current = true;

    (async () => {
      setLoading(true);
      try {
        // Читаем сессию из AsyncStorage (быстро, локально)
        const session = await getSessionUser();

        // Если сессия есть — валидируем в БД, вдруг юзер удалён/заблокирован
        let validSession: User | null = session;
        if (session) {
          try {
            const { data } = await getSupabaseClient()
              .from('jm_users')
              .select('id')
              .eq('id', session.id)
              .maybeSingle();
            if (!data) {
              // Юзер не найден в БД — чистим сессию
              validSession = null;
              await clearSessionUser().catch(() => {});
            }
          } catch {
            // Нет сети — доверяем кэшу, загрузимся с тем что есть
            validSession = session;
          }
        }

        if (validSession) {
          _setCurrentUser(validSession);
        }

        // Загружаем данные параллельно, каждый wrapped в try/catch (уже внутри функций)
        await Promise.allSettled([
          refreshUsers(),
          refreshVacancies(),
          validSession ? refreshLikes(validSession) : Promise.resolve(),
          ...(validSession ? [
            refreshChats(validSession),
            refreshSaved(validSession),
            refreshPermVacancies(validSession),
            refreshPermApplications(validSession),
            refreshPermSaved(validSession),
          ] : []),
        ]);
      } catch (e) {
        console.warn('[AppContext] boot error:', e);
      } finally {
        // ── FIX: loading=false ВСЕГДА, даже если всё упало ──
        setLoading(false);
      }
    })();
  }, []);

  // ── Auto day-switch / cleanup ─────────────────────────────────────────────

  const archivePastDayVacancies = async () => {
    try {
      const visibleDates = getTodayDates();
      const cutoff = visibleDates[0];
      const { data } = await getSupabaseClient()
        .from('jm_vacancies')
        .select('id, date')
        .eq('status', 'open');
      if (!data) return;

      const toArchive = data.filter((v: any) => v.date < cutoff).map((v: any) => v.id);
      if (toArchive.length === 0) return;

      await getSupabaseClient()
        .from('jm_vacancies')
        .update({ status: 'closed' })
        .in('id', toArchive);

      console.log(`[AppContext] archived ${toArchive.length} past-day vacancies (cutoff ${cutoff})`);
      await refreshVacancies();
    } catch (e) {
      console.warn('[AppContext] archivePastDayVacancies error', e);
    }
  };

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
        if (diffMs <= 5 * 60 * 1000 && diffMs > -60 * 60 * 1000) {
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
      }

      if (toDelete.length > 0) {
        await refreshVacancies();
      }
    } catch (e) {
      console.warn('[AppContext] cleanupStaleVacancies error', e);
    }
  };

  // ── Background poll ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser) return;
    archivePastDayVacancies();
    cleanupStaleVacancies();

    const interval = setInterval(() => {
      archivePastDayVacancies();
      cleanupStaleVacancies();
      refreshVacancies();
      refreshLikes(currentUser);
      refreshChats(currentUser);
      refreshSaved(currentUser);
      refreshPermVacancies(currentUser);
      refreshPermApplications(currentUser);
    }, 30_000); // ── FIX: 30s polling — убран refreshUsers

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
        permVacancies,
        refreshPermVacancies,
        permApplications,
        refreshPermApplications,
        permSavedIds,
        refreshPermSaved,
        optimisticAddPermSaved,
        optimisticRemovePermSaved,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
