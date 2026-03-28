/**
 * Supabase data layer — replaces AsyncStorage for persistent data.
 * Utility helpers (uid, formatDate, etc.) remain in storage.ts.
 */
import { getSupabaseClient } from '@/template';
import { User, Vacancy, Like, Chat, Message } from '@/constants/types';
import { uid, nowISO } from '@/services/storage';

const sb = () => getSupabaseClient();

// ─── Users ───────────────────────────────────────────────────────────────────

function rowToUser(r: any): User {
  return {
    id: r.id,
    role: r.role,
    phone: r.phone,
    lastName: r.last_name,
    firstName: r.first_name,
    age: r.age ?? undefined,
    metroLineId: r.metro_line_id ?? undefined,
    metroStation: r.metro_station ?? undefined,
    workTypes: r.work_types ?? [],
    company: r.company ?? undefined,
    createdAt: r.created_at,
  };
}

function userToRow(u: User) {
  return {
    id: u.id,
    role: u.role,
    phone: u.phone,
    last_name: u.lastName,
    first_name: u.firstName,
    age: u.age ?? null,
    metro_line_id: u.metroLineId ?? null,
    metro_station: u.metroStation ?? null,
    work_types: u.workTypes ?? [],
    company: u.company ?? null,
    created_at: u.createdAt,
  };
}

export async function dbGetUsers(): Promise<User[]> {
  const { data, error } = await sb().from('jm_users').select('*').order('created_at', { ascending: true });
  if (error) { console.error('dbGetUsers', error.message); return []; }
  return (data ?? []).map(rowToUser);
}

export async function dbUpsertUser(u: User): Promise<void> {
  const { error } = await sb().from('jm_users').upsert(userToRow(u), { onConflict: 'id' });
  if (error) console.error('dbUpsertUser', error.message);
}

// ─── Vacancies ────────────────────────────────────────────────────────────────

function rowToVacancy(r: any): Vacancy {
  return {
    id: r.id,
    employerId: r.employer_id,
    company: r.company,
    title: r.title,
    workType: r.work_type,
    workTypeLabel: r.work_type_label,
    metroLineId: r.metro_line_id ?? '',
    metroStation: r.metro_station ?? '',
    date: r.date,
    timeStart: r.time_start ?? '',
    timeEnd: r.time_end ?? '',
    salary: r.salary,
    normsAndPay: r.norms_and_pay ?? '',
    workersNeeded: r.workers_needed,
    workersFound: r.workers_found,
    isUrgent: r.is_urgent,
    noExperienceNeeded: r.no_experience_needed,
    conditions: r.conditions ?? '',
    status: r.status,
    createdAt: r.created_at,
  };
}

function vacancyToRow(v: Vacancy) {
  return {
    id: v.id,
    employer_id: v.employerId,
    company: v.company,
    title: v.title,
    work_type: v.workType,
    work_type_label: v.workTypeLabel,
    metro_line_id: v.metroLineId || null,
    metro_station: v.metroStation || null,
    date: v.date,
    time_start: v.timeStart,
    time_end: v.timeEnd,
    salary: v.salary,
    norms_and_pay: v.normsAndPay || null,
    workers_needed: v.workersNeeded,
    workers_found: v.workersFound,
    is_urgent: v.isUrgent,
    no_experience_needed: v.noExperienceNeeded,
    conditions: v.conditions || null,
    status: v.status,
    created_at: v.createdAt,
  };
}

export async function dbGetVacancies(): Promise<Vacancy[]> {
  const { data, error } = await sb().from('jm_vacancies').select('*').order('created_at', { ascending: false });
  if (error) { console.error('dbGetVacancies', error.message); return []; }
  return (data ?? []).map(rowToVacancy);
}

export async function dbUpsertVacancy(v: Vacancy): Promise<void> {
  const { error } = await sb().from('jm_vacancies').upsert(vacancyToRow(v), { onConflict: 'id' });
  if (error) console.error('dbUpsertVacancy', error.message);
}

export async function dbUpdateVacancy(id: string, patch: Partial<{ status: string; workers_found: number }>): Promise<void> {
  const { error } = await sb().from('jm_vacancies').update(patch).eq('id', id);
  if (error) console.error('dbUpdateVacancy', error.message);
}

// ─── Likes ────────────────────────────────────────────────────────────────────

function rowToLike(r: any): Like {
  return {
    id: r.id,
    vacancyId: r.vacancy_id,
    workerId: r.worker_id,
    employerId: r.employer_id,
    workerLiked: r.worker_liked,
    employerLiked: r.employer_liked,
    workerSkipped: r.worker_skipped,
    isMatch: r.is_match,
    matchedAt: r.matched_at ?? undefined,
  };
}

export async function dbGetLikes(): Promise<Like[]> {
  const { data, error } = await sb().from('jm_likes').select('*');
  if (error) { console.error('dbGetLikes', error.message); return []; }
  return (data ?? []).map(rowToLike);
}

export async function dbUpsertLike(
  vacancyId: string,
  workerId: string,
  employerId: string,
  updates: Partial<Like>
): Promise<Like> {
  // Try to find existing
  const { data: existing } = await sb()
    .from('jm_likes')
    .select('*')
    .eq('vacancy_id', vacancyId)
    .eq('worker_id', workerId)
    .maybeSingle();

  const base: any = existing ?? {
    id: uid(),
    vacancy_id: vacancyId,
    worker_id: workerId,
    employer_id: employerId,
    worker_liked: false,
    employer_liked: false,
    worker_skipped: false,
    is_match: false,
    matched_at: null,
  };

  const row = {
    ...base,
    worker_liked: updates.workerLiked ?? base.worker_liked,
    employer_liked: updates.employerLiked ?? base.employer_liked,
    worker_skipped: updates.workerSkipped ?? base.worker_skipped,
    is_match: updates.isMatch ?? base.is_match,
    matched_at: updates.matchedAt ?? base.matched_at,
  };

  const { error } = await sb().from('jm_likes').upsert(row, { onConflict: 'vacancy_id,worker_id' });
  if (error) console.error('dbUpsertLike', error.message);
  return rowToLike(row);
}

export async function dbRemoveLike(vacancyId: string, workerId: string): Promise<void> {
  const { error } = await sb()
    .from('jm_likes')
    .delete()
    .eq('vacancy_id', vacancyId)
    .eq('worker_id', workerId);
  if (error) console.error('dbRemoveLike', error.message);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

function rowToMessage(r: any): Message {
  return {
    id: r.id,
    senderId: r.sender_id,
    text: r.text,
    timestamp: r.created_at,
  };
}

export async function dbGetMessages(chatId: string): Promise<Message[]> {
  const { data, error } = await sb()
    .from('jm_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });
  if (error) { console.error('dbGetMessages', error.message); return []; }
  return (data ?? []).map(rowToMessage);
}

export async function dbInsertMessage(chatId: string, senderId: string, text: string): Promise<Message> {
  const msg = { id: uid(), chat_id: chatId, sender_id: senderId, text, created_at: nowISO() };
  const { error } = await sb().from('jm_messages').insert(msg);
  if (error) console.error('dbInsertMessage', error.message);
  return rowToMessage(msg);
}

// ─── Chats ────────────────────────────────────────────────────────────────────

function rowToChat(r: any, messages: Message[] = []): Chat {
  return {
    id: r.id,
    vacancyId: r.vacancy_id,
    workerId: r.worker_id,
    employerId: r.employer_id,
    vacTitle: r.vac_title ?? '',
    companyName: r.company_name ?? '',
    messages,
    unreadWorker: r.unread_worker ?? 0,
    unreadEmployer: r.unread_employer ?? 0,
    createdAt: r.created_at,
  };
}

export async function dbGetChats(userId: string, role: 'worker' | 'employer'): Promise<Chat[]> {
  const field = role === 'worker' ? 'worker_id' : 'employer_id';
  const { data, error } = await sb()
    .from('jm_chats')
    .select('*')
    .eq(field, userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('dbGetChats', error.message); return []; }

  const chatRows = data ?? [];
  const chats = await Promise.all(
    chatRows.map(async (row: any) => {
      const msgs = await dbGetMessages(row.id);
      return rowToChat(row, msgs);
    })
  );
  return chats;
}

export async function dbCreateChat(
  workerId: string,
  employerId: string,
  vacancyId: string,
  vacTitle: string,
  companyName: string
): Promise<string> {
  // Check if already exists
  const { data: existing } = await sb()
    .from('jm_chats')
    .select('id')
    .eq('vacancy_id', vacancyId)
    .eq('worker_id', workerId)
    .maybeSingle();
  if (existing) return existing.id;

  const chatId = uid();
  const row = {
    id: chatId,
    vacancy_id: vacancyId,
    worker_id: workerId,
    employer_id: employerId,
    vac_title: vacTitle,
    company_name: companyName,
    unread_worker: 1,
    unread_employer: 1,
    created_at: nowISO(),
  };
  const { error } = await sb().from('jm_chats').insert(row);
  if (error) console.error('dbCreateChat', error.message);

  // System welcome message
  await dbInsertMessage(chatId, 'system', '🎉 Мэтч! Вы подошли друг другу. Познакомьтесь и обсудите детали!');
  return chatId;
}

export async function dbMarkRead(chatId: string, role: 'worker' | 'employer'): Promise<void> {
  const field = role === 'worker' ? 'unread_worker' : 'unread_employer';
  const { error } = await sb().from('jm_chats').update({ [field]: 0 }).eq('id', chatId);
  if (error) console.error('dbMarkRead', error.message);
}

export async function dbIncrementUnread(chatId: string, forRole: 'worker' | 'employer'): Promise<void> {
  // Read current, increment
  const { data } = await sb().from('jm_chats').select('unread_worker,unread_employer').eq('id', chatId).maybeSingle();
  if (!data) return;
  const field = forRole === 'worker' ? 'unread_worker' : 'unread_employer';
  const cur = forRole === 'worker' ? data.unread_worker : data.unread_employer;
  await sb().from('jm_chats').update({ [field]: (cur ?? 0) + 1 }).eq('id', chatId);
}

// ─── Saved ────────────────────────────────────────────────────────────────────

export async function dbGetSaved(userId: string): Promise<string[]> {
  const { data, error } = await sb().from('jm_saved').select('vacancy_id').eq('user_id', userId);
  if (error) { console.error('dbGetSaved', error.message); return []; }
  return (data ?? []).map((r: any) => r.vacancy_id);
}

export async function dbAddSaved(userId: string, vacancyId: string): Promise<void> {
  const { error } = await sb().from('jm_saved').upsert({ user_id: userId, vacancy_id: vacancyId });
  if (error) console.error('dbAddSaved', error.message);
}

export async function dbRemoveSaved(userId: string, vacancyId: string): Promise<void> {
  const { error } = await sb().from('jm_saved').delete().eq('user_id', userId).eq('vacancy_id', vacancyId);
  if (error) console.error('dbRemoveSaved', error.message);
}

// ─── Match logic ──────────────────────────────────────────────────────────────

export async function dbCheckAndCreateMatch(
  vacancyId: string,
  workerId: string
): Promise<{ matched: boolean; chatId?: string }> {
  const { data: likeRow } = await sb()
    .from('jm_likes')
    .select('*')
    .eq('vacancy_id', vacancyId)
    .eq('worker_id', workerId)
    .maybeSingle();

  if (!likeRow) return { matched: false };
  if (!likeRow.worker_liked || !likeRow.employer_liked || likeRow.is_match) return { matched: false };

  // Create match
  await sb()
    .from('jm_likes')
    .update({ is_match: true, matched_at: nowISO() })
    .eq('vacancy_id', vacancyId)
    .eq('worker_id', workerId);

  // Get vacancy info
  const { data: vac } = await sb().from('jm_vacancies').select('*').eq('id', vacancyId).maybeSingle();

  const chatId = await dbCreateChat(
    workerId,
    likeRow.employer_id,
    vacancyId,
    vac?.title ?? '',
    vac?.company ?? ''
  );

  return { matched: true, chatId };
}
