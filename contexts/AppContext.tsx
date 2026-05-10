import React, { createContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import { User, Vacancy, Like, Chat, PermVacancy, PermApplication } from '@/constants/types';
import {
  getSessionUser,
  saveSessionUser,
  clearSessionUser,
  extractPhoneDigits,
  loadCache,
  saveCache,
  CACHE_KEYS,
} from '@/services/storage';
import {
  dbGetUsers,
  dbUpsertUser,
  dbGetUserByPhone,
  dbGetVacancies,
  dbGetLikes,
  dbGetLikesForUser,
  dbGetChats,
  dbGetSaved,
  dbGetPermVacancies,
  dbGetPermVacanciesByEmployer,
  dbGetPermApplications,
  dbGetPermSaved,
} from '@/services/db';
import { registerForPushNotifications } from '@/services/notifications';

export interface ToastMessage { message: string; type: 'success' | 'error' | 'info' }

export interface AppContextValue {
  currentUser: User | null;
  loading: boolean;
  toast: ToastMessage | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  users: User[];
  vacancies: Vacancy[];
  likes: Like[];
  chats: Chat[];
  unreadCount: number;
  permVacancies: PermVacancy[];
  permApplications: PermApplication[];
  savedWorkers: User[];
  permSavedWorkers: User[];
  savedIds: string[];
  optimisticAddSaved: (vacancyId: string) => void;
  optimisticRemoveSaved: (vacancyId: string) => void;
  optimisticAddVacancy: (v: Vacancy) => void;
  optimisticUpdateVacancy: (v: Vacancy) => void;
  optimisticAddPermVacancy: (v: PermVacancy) => void;
  optimisticUpdatePermVacancy: (v: PermVacancy) => void;
  optimisticAddChat: (c: Chat) => void;
  optimisticUpdateChat: (c: Chat) => void;
  optimisticAddLike: (l: Like) => void;
  optimisticUpdateLike: (l: Like) => void;
  registerUser: (u: User) => Promise<void>;
  loginUser: (phone: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  refreshVacancies: () => Promise<void>;
  refreshLikes: (u?: User) => Promise<void>;
  refreshChats: (u?: User) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshSaved: (u?: User) => Promise<void>;
  permSavedIds: string[];
  optimisticAddPermSaved: (vacancyId: string) => void;
  optimisticRemovePermSaved: (vacancyId: string) => void;
  refreshPermVacancies: (u?: User) => Promise<void>;
  refreshPermApplications: (u?: User) => Promise<void>;
  refreshPermSaved: (u?: User) => Promise<void>;
  updateUser: (u: User) => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, _setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);
  const [users, setUsers] = useState<User[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [permVacancies, setPermVacancies] = useState<PermVacancy[]>([]);
  const [permApplications, setPermApplications] = useState<PermApplication[]>([]);
  const [savedWorkers, setSavedWorkers] = useState<User[]>([]);
  const [permSavedWorkers, setPermSavedWorkers] = useState<User[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [permSavedIds, setPermSavedIds] = useState<string[]>([]);

  const optimisticAddSaved = useCallback((vacancyId: string) => {
    setSavedIds(prev => prev.includes(vacancyId) ? prev : [...prev, vacancyId]);
  }, []);
  const optimisticRemoveSaved = useCallback((vacancyId: string) => {
    setSavedIds(prev => prev.filter(id => id !== vacancyId));
  }, []);

  const optimisticAddPermSaved = useCallback((vacancyId: string) => {
    setPermSavedIds(prev => prev.includes(vacancyId) ? prev : [...prev, vacancyId]);
  }, []);
  const optimisticRemovePermSaved = useCallback((vacancyId: string) => {
    setPermSavedIds(prev => prev.filter(id => id !== vacancyId));
  }, []);

  const optimisticAddVacancy = useCallback((v: Vacancy) => {
    setVacancies(prev => [v, ...prev.filter(x => x.id !== v.id)]);
  }, []);
  const optimisticUpdateVacancy = useCallback((v: Vacancy) => {
    setVacancies(prev => prev.map(x => x.id === v.id ? v : x));
  }, []);
  const optimisticAddPermVacancy = useCallback((v: PermVacancy) => {
    setPermVacancies(prev => [v, ...prev.filter(x => x.id !== v.id)]);
  }, []);
  const optimisticUpdatePermVacancy = useCallback((v: PermVacancy) => {
    setPermVacancies(prev => prev.map(x => x.id === v.id ? v : x));
  }, []);
  const optimisticAddChat = useCallback((c: Chat) => {
    setChats(prev => [c, ...prev.filter(x => x.id !== c.id)]);
  }, []);
  const optimisticUpdateChat = useCallback((c: Chat) => {
    setChats(prev => prev.map(x => x.id === c.id ? c : x));
  }, []);
  const optimisticAddLike = useCallback((l: Like) => {
    setLikes(prev => [l, ...prev.filter(x => x.id !== l.id)]);
  }, []);
  const optimisticUpdateLike = useCallback((l: Like) => {
    setLikes(prev => prev.map(x => x.id === l.id ? l : x));
  }, []);

  // Boot
  useEffect(() => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; setLoading(false); } };
    // Safety timeout — prevents infinite loading on devices with slow AsyncStorage
    const timer = setTimeout(finish, 5000);
    // Minimum splash display so the loading bar is always visible (parity with web).
    const MIN_SPLASH_MS = 1200;

    (async () => {
      try {
        const [sessionUser] = await Promise.all([
          getSessionUser().catch(() => null),
          new Promise<void>(r => setTimeout(r, MIN_SPLASH_MS)),
        ]);
        if (sessionUser) {
          _setCurrentUser(sessionUser);

          // Load all caches in parallel — AsyncStorage reads < 50ms total
          const [cachedVac, cachedLikes, cachedChats, cachedPermVac, cachedPermApps] = await Promise.all([
            loadCache<Vacancy[]>(CACHE_KEYS.vacancies),
            loadCache<Like[]>(CACHE_KEYS.likes(sessionUser.id)),
            loadCache<Chat[]>(CACHE_KEYS.chats(sessionUser.id)),
            loadCache<PermVacancy[]>(CACHE_KEYS.permVac(sessionUser.id)),
            loadCache<PermApplication[]>(CACHE_KEYS.permApps(sessionUser.id)),
          ]);

          // Show cached data instantly — user sees their screen right away
          if (cachedVac) setVacancies(cachedVac);
          if (cachedLikes) setLikes(cachedLikes);
          if (cachedChats) setChats(cachedChats);
          if (cachedPermVac) setPermVacancies(cachedPermVac);
          if (cachedPermApps) setPermApplications(cachedPermApps);

          // Refresh from Supabase in background — silently updates UI when done.
          // Upsert is awaited first so the POST completes before 8 concurrent GETs
          // start — avoids HTTP/2 stream contention on RN new arch that previously
          // caused the upsert to be silently dropped.
          (async () => {
            try { await dbUpsertUser(sessionUser); } catch {}
            try {
              await Promise.all([
                refreshUsers(),
                refreshVacancies(),
                refreshLikes(sessionUser),
                refreshChats(sessionUser),
                refreshSaved(sessionUser),
                refreshPermVacancies(sessionUser),
                refreshPermApplications(sessionUser),
                refreshPermSaved(sessionUser),
              ]);
            } catch {}
          })();
        }
      } catch (e) {
        console.warn('[AppContext] boot error', e);
      } finally {
        clearTimeout(timer);
        finish();
      }
    })();
    return () => { settled = true; clearTimeout(timer); };
  }, []);

  // Keep Supabase warm while app is open — ping every 4 minutes
  useEffect(() => {
    const sb = getSupabaseClient();
    const interval = setInterval(() => {
      Promise.resolve(sb.from('jm_users').select('id').limit(1)).then(() => {}).catch(() => {});
    }, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    const sb = getSupabaseClient();
    const usersSub    = sb.channel('jm_users_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_users' }, () => refreshUsers()).subscribe();
    const vacSub      = sb.channel('jm_vacancies_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_vacancies' }, () => refreshVacancies()).subscribe();
    const likesSub    = sb.channel('jm_likes_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_likes' }, () => { if (currentUser) refreshLikes(currentUser); }).subscribe();
    const chatsSub    = sb.channel('jm_chats_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_chats' }, () => { if (currentUser) refreshChats(currentUser); }).subscribe();
    const permVacSub  = sb.channel('jm_perm_vacancies_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_perm_vacancies' }, () => { if (currentUser) refreshPermVacancies(currentUser); }).subscribe();
    const permAppSub  = sb.channel('jm_perm_applications_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_perm_applications' }, () => { if (currentUser) refreshPermApplications(currentUser); }).subscribe();
    // New message in any chat → refresh chats list (preview + unread badge)
    const msgSub      = sb.channel('jm_messages_changes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jm_messages' }, () => { if (currentUser) refreshChats(currentUser); }).subscribe();
    // Saved vacancies
    const savedSub    = sb.channel('jm_saved_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_saved' }, () => { if (currentUser) refreshSaved(currentUser); }).subscribe();
    const permSavedSub = sb.channel('jm_perm_saved_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_perm_saved' }, () => { if (currentUser) refreshPermSaved(currentUser); }).subscribe();
    // New rating → also covered by jm_users update, but this fires first so stars update sooner
    const ratingsSub  = sb.channel('jm_ratings_changes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jm_ratings' }, () => refreshUsers()).subscribe();
    return () => {
      usersSub.unsubscribe();
      vacSub.unsubscribe();
      likesSub.unsubscribe();
      chatsSub.unsubscribe();
      permVacSub.unsubscribe();
      permAppSub.unsubscribe();
      msgSub.unsubscribe();
      savedSub.unsubscribe();
      permSavedSub.unsubscribe();
      ratingsSub.unsubscribe();
    };
  }, [currentUser?.id]);

  const registerUser = async (u: User) => {
    _setCurrentUser(u);
    await saveSessionUser(u);
    setLoading(false);
    registerForPushNotifications(u.id).catch(() => {});

    // Await DB write with retries before returning so the caller can be sure
    // the user exists in the DB before navigating to the home screen.
    const delays = [0, 3_000, 7_000];
    let lastError: unknown;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
      try {
        await dbUpsertUser(u);
        lastError = undefined;
        break;
      } catch (e) {
        lastError = e;
        console.warn(`[registerUser] db write attempt ${i + 1} failed`, e);
      }
    }
    if (lastError) throw lastError;

    setTimeout(() => {
      refreshUsers().catch(() => {});
      refreshVacancies().catch(() => {});
      refreshLikes(u).catch(() => {});
      refreshChats(u).catch(() => {});
      refreshSaved(u).catch(() => {});
      refreshPermVacancies(u).catch(() => {});
      refreshPermApplications(u).catch(() => {});
      refreshPermSaved(u).catch(() => {});
    }, 500);
  };

  const loginUser = async (phone: string, password: string): Promise<User | null> => {
    const digits = extractPhoneDigits(phone);
    const found = await dbGetUserByPhone(digits);
    if (!found || found.password !== password) return null;
    _setCurrentUser(found);
    await saveSessionUser(found);
    setLoading(false);
    registerForPushNotifications(found.id).catch(() => {});
    refreshUsers().catch(() => {});
    refreshVacancies().catch(() => {});
    refreshLikes(found).catch(() => {});
    refreshChats(found).catch(() => {});
    refreshSaved(found).catch(() => {});
    refreshPermVacancies(found).catch(() => {});
    refreshPermApplications(found).catch(() => {});
    refreshPermSaved(found).catch(() => {});
    return found;
  };

  const logout = async () => {
    _setCurrentUser(null);
    await clearSessionUser();
    setUsers([]);
    setVacancies([]);
    setLikes([]);
    setChats([]);
    setPermVacancies([]);
    setPermApplications([]);
    setSavedWorkers([]);
    setPermSavedWorkers([]);
    setSavedIds([]);
    setPermSavedIds([]);
  };

  const updateUser = async (u: User) => {
    _setCurrentUser(u);
    await saveSessionUser(u);
    await dbUpsertUser(u);
    await refreshUsers();
  };

  const refreshUsers = async () => {
    const data = await dbGetUsers();
    setUsers(data);
    _setCurrentUser(prev => {
      if (!prev) return prev;
      const fresh = data.find(u => u.id === prev.id);
      if (!fresh) return prev;
      saveSessionUser(fresh).catch(() => {});
      return fresh;
    });
  };

  const refreshVacancies = async () => {
    const data = await dbGetVacancies();
    setVacancies(data);
    saveCache(CACHE_KEYS.vacancies, data).catch(() => {});
  };

  const refreshLikes = async (u?: User) => {
    const user = u ?? currentUser;
    if (!user) {
      const data = await dbGetLikes();
      setLikes(data);
      return;
    }
    const data = await dbGetLikesForUser(user.id, user.role);
    setLikes(data);
    saveCache(CACHE_KEYS.likes(user.id), data).catch(() => {});
  };

  const refreshChats = async (u?: User) => {
    const user = u ?? currentUser;
    if (!user) return;
    const data = await dbGetChats(user.id, user.role);
    setChats(data);
    saveCache(CACHE_KEYS.chats(user.id), data).catch(() => {});
  };

  const refreshAll = useCallback(async () => {
    if (!currentUser) return;
    const user = currentUser;
    await Promise.all([
      refreshUsers(),
      refreshVacancies(),
      refreshLikes(user),
      refreshPermVacancies(user),
      refreshChats(user),
    ]);
  }, [currentUser]);

  const refreshSaved = async (u?: User) => {
    const user = u ?? currentUser;
    if (!user) return;
    if (user.role === 'worker') {
      const ids = await dbGetSaved(user.id);
      setSavedIds(ids);
    }
  };

  const refreshPermVacancies = async (u?: User) => {
    const user = u ?? currentUser;
    if (!user) return;
    const data = user.role === 'employer'
      ? await dbGetPermVacanciesByEmployer(user.id)
      : await dbGetPermVacancies();
    setPermVacancies(data);
    saveCache(CACHE_KEYS.permVac(user.id), data).catch(() => {});
  };

  const refreshPermApplications = async (u?: User) => {
    const user = u ?? currentUser;
    if (!user) return;
    const data = await dbGetPermApplications(user.id, user.role);
    setPermApplications(data);
    saveCache(CACHE_KEYS.permApps(user.id), data).catch(() => {});
  };

  const refreshPermSaved = async (u?: User) => {
    const user = u ?? currentUser;
    if (!user) return;
    if (user.role === 'worker') {
      const ids = await dbGetPermSaved(user.id);
      setPermSavedIds(ids);
    } else {
      const ids = await dbGetPermSaved(user.id);
      setPermSavedIds(ids);
    }
  };

  const unreadCount = chats.reduce((sum, c) => {
    if (currentUser?.role === 'worker') return sum + (c.unreadWorker ?? 0);
    if (currentUser?.role === 'employer') return sum + (c.unreadEmployer ?? 0);
    return sum;
  }, 0);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        loading,
        toast,
        showToast,
        users,
        vacancies,
        likes,
        chats,
        unreadCount,
        permVacancies,
        permApplications,
        savedWorkers,
        permSavedWorkers,
        savedIds,
        optimisticAddSaved,
        optimisticRemoveSaved,
        optimisticAddVacancy,
        optimisticUpdateVacancy,
        optimisticAddPermVacancy,
        optimisticUpdatePermVacancy,
        optimisticAddChat,
        optimisticUpdateChat,
        optimisticAddLike,
        optimisticUpdateLike,
        permSavedIds,
        optimisticAddPermSaved,
        optimisticRemovePermSaved,
        registerUser,
        loginUser,
        logout,
        refreshUsers,
        refreshVacancies,
        refreshLikes,
        refreshChats,
        refreshSaved,
        refreshPermVacancies,
        refreshPermApplications,
        refreshPermSaved,
        refreshAll,
        updateUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};