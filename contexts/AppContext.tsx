import React, { createContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import { User, Vacancy, Like, Chat, PermVacancy, PermApplication } from '@/constants/types';
import {
  getSessionUser,
  saveSessionUser,
  clearSessionUser,
  getTodayDate,
  extractPhoneDigits,
} from '@/services/storage';
import {
  dbGetUsers,
  dbUpsertUser,
  dbGetVacancies,
  dbGetLikes,
  dbGetChats,
  dbGetMessages,
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
  permVacancies: PermVacancy[];
  permApplications: PermApplication[];
  savedWorkers: User[];
  permSavedWorkers: User[];
  registerUser: (u: User) => Promise<void>;
  loginUser: (phone: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  refreshVacancies: () => Promise<void>;
  refreshLikes: () => Promise<void>;
  refreshChats: (u: User) => Promise<void>;
  refreshSaved: (u: User) => Promise<void>;
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
  const [permSavedIds, setPermSavedIds] = useState<string[]>([]);

  const optimisticAddPermSaved = useCallback((vacancyId: string) => {
    setPermSavedIds(prev => prev.includes(vacancyId) ? prev : [...prev, vacancyId]);
  }, []);
  const optimisticRemovePermSaved = useCallback((vacancyId: string) => {
    setPermSavedIds(prev => prev.filter(id => id !== vacancyId));
  }, []);

  // Boot
  useEffect(() => {
    (async () => {
      try {
        const sessionUser = await getSessionUser();
        if (sessionUser) {
          _setCurrentUser(sessionUser);
          await Promise.all([
            refreshUsers(),
            refreshVacancies(),
            refreshLikes(),
            refreshChats(sessionUser),
            refreshSaved(sessionUser),
            refreshPermVacancies(sessionUser),
            refreshPermApplications(sessionUser),
            refreshPermSaved(sessionUser),
          ]);
        }
      } catch (e) {
        console.warn('[AppContext] boot error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    const sb = getSupabaseClient();
    const usersSub = sb.channel('jm_users_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_users' }, () => refreshUsers()).subscribe();
    const vacSub = sb.channel('jm_vacancies_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_vacancies' }, () => refreshVacancies()).subscribe();
    const likesSub = sb.channel('jm_likes_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_likes' }, () => refreshLikes()).subscribe();
    const chatsSub = sb.channel('jm_chats_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_chats' }, () => { if (currentUser) refreshChats(currentUser); }).subscribe();
    const permVacSub = sb.channel('jm_perm_vacancies_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_perm_vacancies' }, () => { if (currentUser) refreshPermVacancies(currentUser); }).subscribe();
    const permAppSub = sb.channel('jm_perm_applications_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'jm_perm_applications' }, () => { if (currentUser) refreshPermApplications(currentUser); }).subscribe();
    return () => {
      usersSub.unsubscribe();
      vacSub.unsubscribe();
      likesSub.unsubscribe();
      chatsSub.unsubscribe();
      permVacSub.unsubscribe();
      permAppSub.unsubscribe();
    };
  }, [currentUser?.id]);

  const registerUser = async (u: User) => {
    _setCurrentUser(u);
    await saveSessionUser(u);
    setLoading(false); // ← критично для разблокировки AuthGuard
    registerForPushNotifications(u.id).catch(() => {});
    // Все запросы к БД в фоне
    dbUpsertUser(u).catch(e => console.warn('[registerUser] db write error', e));
    refreshUsers().catch(() => {});
    refreshVacancies().catch(() => {});
    refreshLikes().catch(() => {});
    refreshChats(u).catch(() => {});
    refreshSaved(u).catch(() => {});
    refreshPermVacancies(u).catch(() => {});
    refreshPermApplications(u).catch(() => {});
    refreshPermSaved(u).catch(() => {});
  };

  const loginUser = async (phone: string, password: string): Promise<User | null> => {
    const digits = extractPhoneDigits(phone);
    const all = await dbGetUsers();
    const found = all.find(u => u.phone === digits && u.password === password);
    if (!found) return null;
    _setCurrentUser(found);
    await saveSessionUser(found);
    setLoading(false);
    registerForPushNotifications(found.id).catch(() => {});
    refreshUsers().catch(() => {});
    refreshVacancies().catch(() => {});
    refreshLikes().catch(() => {});
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
  };

  const refreshVacancies = async () => {
    const data = await dbGetVacancies();
    const today = getTodayDate();
    setVacancies(data.filter(v => v.date === today));
  };

  const refreshLikes = async () => {
    const data = await dbGetLikes();
    setLikes(data);
  };

  const refreshChats = async (u: User) => {
    const data = await dbGetChats();
    const mine = data.filter(c => c.userId === u.id || c.employerId === u.id);
    for (const chat of mine) {
      chat.messages = await dbGetMessages(chat.id);
    }
    setChats(mine);
  };

  const refreshSaved = async (u: User) => {
    if (u.role !== 'employer') return;
    const allLikes = await dbGetLikes();
    const saved = allLikes.filter(l => l.employerId === u.id && l.saved);
    const workerIds = saved.map(l => l.userId);
    const allUsers = await dbGetUsers();
    setSavedWorkers(allUsers.filter(user => workerIds.includes(user.id)));
  };

  const refreshPermVacancies = async (u?: User) => {
    const user = u ?? currentUser;
    if (!user) return;
    if (user.role === 'employer') {
      const data = await dbGetPermVacanciesByEmployer(user.id);
      setPermVacancies(data);
    } else {
      const data = await dbGetPermVacancies();
      setPermVacancies(data);
    }
  };

  const refreshPermApplications = async (u?: User) => {
    const user = u ?? currentUser;
    if (!user) return;
    const data = await dbGetPermApplications(user.id, user.role);
    setPermApplications(data);
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
        permVacancies,
        permApplications,
        savedWorkers,
        permSavedWorkers,
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
        updateUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};