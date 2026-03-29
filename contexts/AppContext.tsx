import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
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
  setCurrentUser: (u: User | null) => Promise<void>;
  users: User[];
  refreshUsers: () => Promise<void>;
  vacancies: Vacancy[];
  setVacancies: (arr: Vacancy[]) => void;
  refreshVacancies: () => Promise<void>;
  likes: Like[];
  refreshLikes: () => Promise<void>;
  chats: Chat[];
  refreshChats: () => Promise<void>;
  savedIds: string[];
  refreshSaved: () => Promise<void>;
  toast: ToastData | null;
  showToast: (message: string, type?: 'success' | 'error' | 'match') => void;
  refreshAll: () => Promise<void>;
  unreadCount: number;
  loading: boolean;
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
  const [loading, setLoading] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Session ──────────────────────────────────────────────────────────────

  const setCurrentUser = async (u: User | null) => {
    _setCurrentUser(u);
    if (u) {
      await saveSessionUser(u);
      // Immediately load fresh data for this user
      await Promise.all([
        refreshUsers(),
        refreshVacancies(),
        refreshLikes(),
        refreshChats(u),
        refreshSaved(u),
      ]);
    } else {
      await clearSessionUser();
      // Clear user-specific state immediately
      setChats([]);
      setSavedIds([]);
      setLikes([]);
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

  // ── Boot ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoading(true);
      const session = await getSessionUser();
      if (session) _setCurrentUser(session);
      await Promise.all([
        refreshUsers(),
        refreshVacancies(),
        refreshLikes(),
        ...(session ? [refreshChats(session), refreshSaved(session)] : []),
      ]);
      setLoading(false);
    })();
  }, []);

  // ── Background poll (every 15s) when user is logged in ───────────────────

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      refreshVacancies();
      refreshLikes();
      refreshChats(currentUser);
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
        refreshLikes,
        chats,
        refreshChats,
        savedIds,
        refreshSaved,
        toast,
        showToast,
        refreshAll,
        unreadCount,
        loading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
