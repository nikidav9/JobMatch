import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Vacancy } from '@/constants/types';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const nowISO = () => new Date().toISOString();

const KEY_CURRENT = 'jm_currentUser';

// ─── Session (current user in AsyncStorage for fast boot) ────────────────────

export async function getSessionUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CURRENT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveSessionUser(u: User): Promise<void> {
  await AsyncStorage.setItem(KEY_CURRENT, JSON.stringify(u));
}

export async function clearSessionUser(): Promise<void> {
  await AsyncStorage.removeItem(KEY_CURRENT);
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function nameColorFromString(str: string): string {
  const colors = ['#FF6B1A', '#2563EB', '#16A34A', '#7C3AED', '#DC2626', '#0CACCA'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return `${days[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function getTodayDates(count = 7): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Priority-based vacancy scoring:
 * 1. Same metro station → 100
 * 2. Same metro line   → 60
 * 3. Everything else   → 20
 */
export function scoreVacancy(vacancy: Vacancy, user: User): number {
  if (user.metroStation && user.metroStation === vacancy.metroStation) return 100;
  if (user.metroLineId && user.metroLineId === vacancy.metroLineId) return 60;
  return 20;
}

// ─── Phone helpers ────────────────────────────────────────────────────────────

export function isPhoneComplete(formatted: string): boolean {
  const digits = formatted.replace(/\D/g, '');
  const local = digits.startsWith('7') || digits.startsWith('8') ? digits.slice(1) : digits;
  return local.length === 10;
}

export function extractPhoneDigits(formatted: string): string {
  const digits = formatted.replace(/\D/g, '');
  if (digits.startsWith('7') || digits.startsWith('8')) return '7' + digits.slice(1, 11);
  return '7' + digits.slice(0, 10);
}
