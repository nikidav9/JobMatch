import { useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    // Return safe defaults instead of throwing — prevents black screen on cold boot
    return {
      currentUser: null,
      setCurrentUser: () => {},
      users: [],
      refreshUsers: async () => {},
      vacancies: [],
      setVacancies: () => {},
      refreshVacancies: async () => {},
      likes: [],
      setLikes: () => {},
      refreshLikes: async (_user?: any) => {},
      chats: [],
      refreshChats: async () => {},
      savedIds: [],
      setSavedIds: () => {},
      refreshSaved: async () => {},
      optimisticAddSaved: () => {},
      optimisticRemoveSaved: () => {},
      optimisticUpdateLike: () => {},
      toast: null,
      showToast: () => {},
      refreshAll: async () => {},
      logout: async () => {},
      unreadCount: 0,
      loading: true,
      permVacancies: [],
      refreshPermVacancies: async () => {},
      permApplications: [],
      refreshPermApplications: async () => {},
      permSavedIds: [],
      refreshPermSaved: async () => {},
      optimisticAddPermSaved: () => {},
      optimisticRemovePermSaved: () => {},
    } as any;
  }
  return ctx;
}
