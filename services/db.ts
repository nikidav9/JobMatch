/**
 * Supabase data layer — replaces AsyncStorage for persistent data.
 */
import { getSupabaseClient } from '@/template';
import { User, Vacancy, Like, Chat, Message } from '@/constants/types';
import { uid, nowISO } from '@/services/storage';

const sb = () => getSupabaseClient();

// ─── Error helper ────────────────────────────────────────────────────────────

function throwOnError(label: string, error: any): never {
  const msg = error?.message ?? String(error);
  console.error(`[db] ${label}:`, msg);
  throw new Error(msg);
}

// ─── Users ────────────────────────────────────────────────────────────────────

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
    isBlocked: r.is_blocked ?? false,
    avatarUrl: r.avatar_url ?? undefined,
    avgRating: r.avg_rating ?? 0,
    ratingCount: r.rating_count ?? 0,
    password: r.password ?? '',
    bio: r.bio ?? undefined,
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
    is_blocked: u.isBlocked ?? false,
    avatar_url: u.avatarUrl ?? null,
    avg_rating: u.avgRating ?? 0,
    rating_count: u.ratingCount ?? 0,
    password: u.password ?? '',
    bio: u.bio ?? null,
  };
}

export async function dbGetUsers(): Promise<User[]> {
  const { data, error } = await sb().from('jm_users').select('*').order('created_at', { ascending: true });
  if (error) throwOnError('dbGetUsers', error);
  return (data ?? []).map(rowToUser);
}

export async function dbUpsertUser(u: User): Promise<void> {
  const { error } = await sb().from('jm_users').upsert(userToRow(u), { onConflict: 'id' });
  if (error) throwOnError('dbUpsertUser', error);
}

export async function dbDeleteUser(id: string): Promise<void> {
  const { error } = await sb().from('jm_users').delete().eq('id', id);
  if (error) console.error('dbDeleteUser', error.message);
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
    address: r.address ?? '',
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
    address: v.address || null,
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
  if (error) throwOnError('dbGetVacancies', error);
  return (data ?? []).map(rowToVacancy);
}

export async function dbUpsertVacancy(v: Vacancy): Promise<void> {
  const { error } = await sb().from('jm_vacancies').upsert(vacancyToRow(v), { onConflict: 'id' });
  if (error) {
    console.error('dbUpsertVacancy', error.message);
    throw new Error(error.message);
  }
}

export async function dbUpdateVacancy(id: string, patch: Partial<{ status: string; workers_found: number }>): Promise<void> {
  const { error } = await sb().from('jm_vacancies').update(patch).eq('id', id);
  if (error) throwOnError('dbUpdateVacancy', error);
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
    workerConfirmed: r.worker_confirmed ?? false,
    employerConfirmed: r.employer_confirmed ?? false,
    workerRated: r.worker_rated ?? false,
    employerRated: r.employer_rated ?? false,
    shiftCompleted: r.shift_completed ?? false,
  };
}

export async function dbGetLikes(): Promise<Like[]> {
  const { data, error } = await sb().from('jm_likes').select('*');
  if (error) throwOnError('dbGetLikes', error);
  return (data ?? []).map(rowToLike);
}

export async function dbUpsertLike(
  vacancyId: string,
  workerId: string,
  employerId: string,
  updates: Partial<Like>
): Promise<Like> {
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
    employer_liked: null,
    worker_skipped: false,
    is_match: false,
    matched_at: null,
    worker_confirmed: false,
    employer_confirmed: false,
    worker_rated: false,
    employer_rated: false,
    shift_completed: false,
  };

  const row = {
    ...base,
    worker_liked: updates.workerLiked ?? base.worker_liked,
    employer_liked: updates.employerLiked ?? base.employer_liked,
    worker_skipped: updates.workerSkipped ?? base.worker_skipped,
    is_match: updates.isMatch ?? base.is_match,
    matched_at: updates.matchedAt ?? base.matched_at,
    worker_confirmed: updates.workerConfirmed ?? base.worker_confirmed,
    employer_confirmed: updates.employerConfirmed ?? base.employer_confirmed,
    worker_rated: updates.workerRated ?? base.worker_rated,
    employer_rated: updates.employerRated ?? base.employer_rated,
    shift_completed: updates.shiftCompleted ?? base.shift_completed,
  };

  const { error } = await sb().from('jm_likes').upsert(row, { onConflict: 'vacancy_id,worker_id' });
  if (error) throwOnError('dbUpsertLike', error);
  return rowToLike(row);
}

export async function dbRemoveLike(vacancyId: string, workerId: string): Promise<void> {
  const { error } = await sb()
    .from('jm_likes')
    .delete()
    .eq('vacancy_id', vacancyId)
    .eq('worker_id', workerId);
  if (error) throwOnError('dbRemoveLike', error);
}

export async function dbDeleteMatch(likeId: string): Promise<void> {
  const { error } = await sb().from('jm_likes').delete().eq('id', likeId);
  if (error) throwOnError('dbDeleteMatch', error);
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
  if (error) throwOnError('dbGetMessages', error);
  return (data ?? []).map(rowToMessage);
}

export async function dbInsertMessage(chatId: string, senderId: string, text: string): Promise<Message> {
  const msg = { id: uid(), chat_id: chatId, sender_id: senderId, text, created_at: nowISO() };
  const { error } = await sb().from('jm_messages').insert(msg);
  if (error) {
    console.error('dbInsertMessage', error.message);
    throw new Error(error.message);
  }
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
  if (error) throwOnError('dbGetChats', error);

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
  if (error) throwOnError('dbCreateChat', error);

  await dbInsertMessage(chatId, 'system', '🎉 Мэтч! Вы подошли друг другу. Познакомьтесь и обсудите детали!');
  return chatId;
}

export async function dbMarkRead(chatId: string, role: 'worker' | 'employer'): Promise<void> {
  const field = role === 'worker' ? 'unread_worker' : 'unread_employer';
  const { error } = await sb().from('jm_chats').update({ [field]: 0 }).eq('id', chatId);
  if (error) throwOnError('dbMarkRead', error);
}

export async function dbIncrementUnread(chatId: string, forRole: 'worker' | 'employer'): Promise<void> {
  const { data } = await sb().from('jm_chats').select('unread_worker,unread_employer').eq('id', chatId).maybeSingle();
  if (!data) return;
  const field = forRole === 'worker' ? 'unread_worker' : 'unread_employer';
  const cur = forRole === 'worker' ? data.unread_worker : data.unread_employer;
  await sb().from('jm_chats').update({ [field]: (cur ?? 0) + 1 }).eq('id', chatId);
}

export async function dbDeleteChat(chatId: string): Promise<void> {
  await sb().from('jm_messages').delete().eq('chat_id', chatId);
  await sb().from('jm_chats').delete().eq('id', chatId);
}

// ─── Saved ────────────────────────────────────────────────────────────────────

export async function dbGetSaved(userId: string): Promise<string[]> {
  const { data, error } = await sb().from('jm_saved').select('vacancy_id').eq('user_id', userId);
  if (error) throwOnError('dbGetSaved', error);
  return (data ?? []).map((r: any) => r.vacancy_id);
}

export async function dbAddSaved(userId: string, vacancyId: string): Promise<void> {
  const { error } = await sb().from('jm_saved').upsert({ user_id: userId, vacancy_id: vacancyId });
  if (error) throwOnError('dbAddSaved', error);
}

export async function dbRemoveSaved(userId: string, vacancyId: string): Promise<void> {
  const { error } = await sb().from('jm_saved').delete().eq('user_id', userId).eq('vacancy_id', vacancyId);
  if (error) throwOnError('dbRemoveSaved', error);
}

// ─── Complaints ───────────────────────────────────────────────────────────────

export async function dbFileComplaint(params: {
  reporterId: string;
  reporterPhone: string;
  reporterCompany?: string;
  targetId: string;
  targetPhone: string;
  targetCompany?: string;
  complaintType: 'worker' | 'employer';
  description?: string;
}): Promise<void> {
  const { error } = await sb().from('jm_complaints').insert({
    id: uid(),
    reporter_id: params.reporterId,
    reporter_phone: params.reporterPhone,
    reporter_company: params.reporterCompany ?? null,
    target_id: params.targetId,
    target_phone: params.targetPhone,
    target_company: params.targetCompany ?? null,
    complaint_type: params.complaintType,
    description: params.description ?? null,
    created_at: nowISO(),
  });
  if (error) throwOnError('dbFileComplaint', error);
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

  await sb()
    .from('jm_likes')
    .update({ is_match: true, matched_at: nowISO() })
    .eq('vacancy_id', vacancyId)
    .eq('worker_id', workerId);

  const { data: vac } = await sb().from('jm_vacancies').select('*').eq('id', vacancyId).maybeSingle();

  const chatId = await dbCreateChat(
    workerId,
    likeRow.employer_id,
    vacancyId,
    vac?.title ?? '',
    vac?.company ?? ''
  );

  // Update vacancy workersFound and status if limit reached
  if (vac) {
    const newWorkersFound = (vac.workers_found || 0) + 1;
    const newStatus = newWorkersFound >= vac.workers_needed ? 'closed' : 'open';
    await sb()
      .from('jm_vacancies')
      .update({ workers_found: newWorkersFound, status: newStatus })
      .eq('id', vacancyId);
  }

  return { matched: true, chatId };
}

// ─── Ratings for user ────────────────────────────────────────────────────────

export interface UserRating {
  id: string;
  fromUserId: string;
  rating: number;
  reviewText?: string;
  role: 'worker' | 'employer';
  createdAt: string;
  vacancyId: string;
}

export async function dbGetRatingsForUser(toUserId: string): Promise<UserRating[]> {
  const { data, error } = await sb()
    .from('jm_ratings')
    .select('*')
    .eq('to_user_id', toUserId)
    .order('created_at', { ascending: false });
  if (error) throwOnError('dbGetRatingsForUser', error);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    rating: r.rating,
    reviewText: r.review_text ?? undefined,
    role: r.role,
    createdAt: r.created_at,
    vacancyId: r.vacancy_id,
  }));
}

// ─── Shift confirmation ───────────────────────────────────────────────────────

export async function dbConfirmShift(
  likeId: string,
  role: 'worker' | 'employer'
): Promise<{ bothConfirmed: boolean }> {
  const field = role === 'worker' ? 'worker_confirmed' : 'employer_confirmed';
  await sb().from('jm_likes').update({ [field]: true }).eq('id', likeId);

  const { data } = await sb().from('jm_likes').select('worker_confirmed,employer_confirmed').eq('id', likeId).maybeSingle();
  if (data?.worker_confirmed && data?.employer_confirmed) {
    await sb().from('jm_likes').update({ shift_completed: true }).eq('id', likeId);
    return { bothConfirmed: true };
  }
  return { bothConfirmed: false };
}

// ─── Rating & match deletion ──────────────────────────────────────────────────

export async function dbSubmitRatingAndMaybeDelete(params: {
  likeId: string;
  fromUserId: string;
  toUserId: string;
  vacancyId: string;
  rating: number;
  role: 'worker' | 'employer';
  reviewText?: string;
}): Promise<{ bothRated: boolean }> {
  const { likeId, fromUserId, toUserId, vacancyId, rating, role, reviewText } = params;

  // Save rating record
  await sb().from('jm_ratings').insert({
    id: uid(),
    from_user_id: fromUserId,
    to_user_id: toUserId,
    vacancy_id: vacancyId,
    like_id: likeId,
    rating,
    role,
    review_text: reviewText ?? null,
    created_at: nowISO(),
  });

  // Mark as rated on like row
  const ratedField = role === 'worker' ? 'worker_rated' : 'employer_rated';
  await sb().from('jm_likes').update({ [ratedField]: true }).eq('id', likeId);

  // Update target user average rating
  const { data: allRatings } = await sb()
    .from('jm_ratings')
    .select('rating')
    .eq('to_user_id', toUserId);
  if (allRatings && allRatings.length > 0) {
    const avg = allRatings.reduce((s: number, r: any) => s + r.rating, 0) / allRatings.length;
    await sb().from('jm_users').update({
      avg_rating: Math.round(avg * 100) / 100,
      rating_count: allRatings.length,
    }).eq('id', toUserId);
  }

  // Check if both sides have now rated
  const { data: likeRow } = await sb()
    .from('jm_likes')
    .select('worker_rated,employer_rated')
    .eq('id', likeId)
    .maybeSingle();

  if (likeRow?.worker_rated && likeRow?.employer_rated) {
    // Both rated — delete the match (like row)
    await sb().from('jm_likes').delete().eq('id', likeId);
    return { bothRated: true };
  }
  return { bothRated: false };
}
