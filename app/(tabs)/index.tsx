import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, PanResponder, Dimensions, RefreshControl, Modal, FlatList,
  TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { Like, User, Vacancy, PermVacancy } from '@/constants/types';
import { getTodayDates, formatDate, scoreVacancy } from '@/services/storage';
import { METRO_LINES } from '@/constants/metro';
import {
  dbUpsertLike,
  dbCheckAndCreateMatch,
  dbRemoveLike,
  dbAddSaved,
  dbUpdateVacancy,
  dbCreateChat,
  dbInsertMessage,
  dbIncrementUnread,
  dbApplyPermVacancy,
  dbAddPermSaved,
  dbRemovePermSaved,
  dbClosePermVacancy,
} from '@/services/db';
import { notifyWorkerSentApplication, notifyWorkerGotMatch, notifyEmployerGotMatch } from '@/services/notifications';
import { Image } from 'expo-image';
import { Chip } from '@/components/ui/Chip';
import { VacancyDetailModal } from '@/components/feature/VacancyDetailModal';
import { nameColorFromString, getInitials } from '@/services/storage';

const { width: SW } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.3;

// ─────────────────────────────────────────────────
// Mode switcher
// ─────────────────────────────────────────────────
type AppMode = 'shift' | 'perm';

function ModeSwitcher({ mode, onChange }: { mode: AppMode; onChange: (m: AppMode) => void }) {
  return (
    <View style={ms.container}>
      <TouchableOpacity
        style={[ms.btn, mode === 'shift' && ms.btnActive]}
        onPress={() => onChange('shift')}
        activeOpacity={0.8}
      >
        <Text style={[ms.btnTxt, mode === 'shift' && ms.btnTxtActive]}>⚡ Подработка</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[ms.btn, mode === 'perm' && ms.btnActive]}
        onPress={() => onChange('perm')}
        activeOpacity={0.8}
      >
        <Text style={[ms.btnTxt, mode === 'perm' && ms.btnTxtActive]}>💼 Работа</Text>
      </TouchableOpacity>
    </View>
  );
}

const ms = StyleSheet.create({
  container: {
    flexDirection: 'row', gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 100, padding: 4,
    borderWidth: 1, borderColor: Colors.divider,
  },
  btn: { flex: 1, borderRadius: 100, paddingVertical: 7, alignItems: 'center' },
  btnActive: { backgroundColor: Colors.bg, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  btnTxt: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  btnTxtActive: { color: Colors.textPrimary, fontWeight: '700' },
});

// ─────────────────────────────────────────────────
// Worker List Modal (for employer vacancy stats)
// ─────────────────────────────────────────────────
function WorkerListModal({
  vacancyId,
  type,
  onClose,
}: {
  vacancyId: string;
  type: 'applicants' | 'hired' | 'rejected';
  onClose: () => void;
}) {
  const router = useRouter();
  const { currentUser, users, vacancies, likes, chats, refreshAll, showToast } = useApp();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const vacancy = vacancies.find(v => v.id === vacancyId);

  const titleMap = {
    applicants: '👥 Отклики',
    hired: '✅ Набрано',
    rejected: '👎 Отклонённые',
  };

  const vacLikes = likes.filter(l => l.vacancyId === vacancyId);
  let filteredLikes: Like[] = [];
  if (type === 'applicants') {
    filteredLikes = vacLikes.filter(l => l.workerLiked && !l.isMatch && l.employerLiked !== false);
  } else if (type === 'hired') {
    filteredLikes = vacLikes.filter(l => l.isMatch);
  } else {
    filteredLikes = vacLikes.filter(
      l => l.employerLiked === false || (l.workerLiked === false && l.workerSkipped === true)
    );
  }

  const getWorker = (id: string) => users.find(u => u.id === id);
  const getChatId = (workerId: string) =>
    chats.find(c => c.vacancyId === vacancyId && c.workerId === workerId)?.id ?? null;

  const onAccept = async (like: Like) => {
    if (!currentUser || !vacancy) return;
    setActionLoading(like.workerId);
    try {
      await dbUpsertLike(vacancyId, like.workerId, currentUser.id, { employerLiked: true });
      const result = await dbCheckAndCreateMatch(vacancyId, like.workerId);
      await refreshAll();
      if (result.matched) {
        const worker = getWorker(like.workerId);
        await notifyEmployerGotMatch(worker ? `${worker.firstName} ${worker.lastName}` : 'Работник', vacancy.title);
        showToast('🎉 Мэтч! Чат открыт', 'match');
        onClose();
        if (result.chatId) {
          router.push({ pathname: '/chat-room', params: { chatId: result.chatId } });
        } else {
          router.push({ pathname: '/(tabs)/chats' });
        }
      } else {
        showToast('Принято. Ждём подтверждения работника.', 'success');
      }
    } catch {
      showToast('Ошибка', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const openChat = (workerId: string) => {
    const chatId = getChatId(workerId);
    onClose();
    if (chatId) {
      router.push({ pathname: '/chat-room', params: { chatId } });
    } else {
      router.push({ pathname: '/(tabs)/chats' });
    }
  };

  const onReject = async (like: Like) => {
    if (!currentUser) return;
    setActionLoading(like.workerId);
    try {
      await dbUpsertLike(vacancyId, like.workerId, currentUser.id, { employerLiked: false });
      await refreshAll();
      showToast('Отклонено', 'success');
    } catch {
      showToast('Ошибка', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const onDiscussRejected = async (like: Like) => {
    if (!currentUser || !vacancy) return;
    setActionLoading(like.workerId);
    try {
      const worker = users.find(u => u.id === like.workerId);
      if (!worker) throw new Error('Работник не найден');

      const chatId = await dbCreateChat(
        like.workerId,
        currentUser.id,
        vacancyId,
        vacancy.title,
        vacancy.company,
        '',
        0,
        0,
      );

      const text = `Здравствуйте, ${worker.firstName}! Вы были отклонены по вакансии «${vacancy.title}». Я бы хотел обсудить причину и, возможно, найти решение.`;
      await dbInsertMessage(chatId, currentUser.id, text);
      await dbIncrementUnread(chatId, 'worker');
      await refreshAll();

      showToast('Сообщение отправлено. Открываем чат...', 'success');
      onClose();
      router.push({ pathname: '/chat-room', params: { chatId } });
    } catch (error) {
      console.error('[WorkerListModal] onDiscussRejected', error);
      showToast('Ошибка при отправке сообщения', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={wS.overlay}>
        <View style={wS.sheet}>
          <View style={wS.handle} />
          <View style={wS.sheetHeader}>
            <Text style={wS.sheetTitle}>{titleMap[type]}</Text>
            <TouchableOpacity onPress={onClose} style={wS.closeBtn}>
              <Text style={wS.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          {vacancy ? (
            <Text style={wS.vacSubtitle} numberOfLines={1}>📋 {vacancy.title} · 📅 {formatDate(vacancy.date)}</Text>
          ) : null}

          {filteredLikes.length === 0 ? (
            <View style={wS.empty}>
              <Text style={{ fontSize: 36 }}>{type === 'applicants' ? '👀' : type === 'hired' ? '🤝' : '🙅'}</Text>
              <Text style={wS.emptyTxt}>
                {type === 'applicants' ? 'Нет новых откликов' : type === 'hired' ? 'Никого не набрано' : 'Нет отклонённых'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredLikes}
              keyExtractor={l => l.id}
              contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
              renderItem={({ item: like }) => {
                const worker = getWorker(like.workerId);
                if (!worker) return null;
                const workerColor = nameColorFromString(worker.id);
                const initials = getInitials(`${worker.firstName} ${worker.lastName}`);
                const isLoading = actionLoading === like.workerId;
                const rejectedByWorker = like.workerLiked === false && like.workerSkipped === true;
                return (
                  <View style={wS.card}>
                    <TouchableOpacity
                      style={wS.cardTop}
                      onPress={() => { onClose(); router.push({ pathname: '/user-profile', params: { userId: worker.id } }); }}
                      activeOpacity={0.8}
                    >
                      {worker.avatarUrl ? (
                        <Image source={{ uri: worker.avatarUrl }} style={wS.avatar} contentFit="cover" transition={150} />
                      ) : (
                        <View style={[wS.avatar, { backgroundColor: workerColor, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={wS.avatarTxt}>{initials}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={wS.name}>{worker.firstName} {worker.lastName}</Text>
                        <Text style={wS.meta}>
                          {like.isMatch ? `📞 ${worker.phone}` : `🚇 ${worker.metroStation ?? '—'}`}
                          {(worker.avgRating ?? 0) > 0 ? `  ·  ⭐ ${(worker.avgRating ?? 0).toFixed(1)}` : ''}
                        </Text>
                        {type === 'rejected' ? (
                          <Text style={wS.rejectionReason}>
                            {rejectedByWorker ? '← Сам отказался' : '← Вы отклонили'}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={wS.profileArrow}>Профиль ›</Text>
                    </TouchableOpacity>

                    <View style={wS.btnRow}>
                      {type === 'hired' ? (
                        <TouchableOpacity
                          style={wS.chatBtn}
                          onPress={() => openChat(like.workerId)}
                        >
                          <Text style={wS.chatBtnTxt}>💬 Написать</Text>
                        </TouchableOpacity>
                      ) : type === 'rejected' ? (
                        <TouchableOpacity
                          style={[wS.chatBtn, { flex: 1 }, isLoading && { opacity: 0.5 }]}
                          disabled={isLoading}
                          onPress={() => onDiscussRejected(like)}
                        >
                          <Text style={wS.chatBtnTxt}>💬 Написать</Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[wS.rejectBtn, isLoading && { opacity: 0.5 }]}
                            disabled={isLoading}
                            onPress={() => onReject(like)}
                          >
                            <Text style={wS.rejectBtnTxt}>✕ Не подходит</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[wS.acceptBtn, { flex: 1 }, isLoading && { opacity: 0.5 }]}
                            disabled={isLoading}
                            onPress={() => onAccept(like)}
                          >
                            <Text style={wS.acceptBtnTxt}>✅ Написать</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const wS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: Colors.inputBorder, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: { padding: 4 },
  closeTxt: { fontSize: 18, color: Colors.textMuted },
  vacSubtitle: { fontSize: 12, color: Colors.textMuted, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  empty: { alignItems: 'center', padding: 48, gap: 10 },
  emptyTxt: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  meta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  profileArrow: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 8 },
  rejectionReason: { fontSize: 11, color: Colors.red, marginTop: 3, fontStyle: 'italic' },
  rejectBtn: { flex: 1, borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 100, paddingVertical: 9, alignItems: 'center', backgroundColor: '#FEF2F2' },
  rejectBtnTxt: { fontSize: 13, color: Colors.red, fontWeight: '600' },
  acceptBtn: { backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  acceptBtnTxt: { fontSize: 13, color: '#fff', fontWeight: '700' },
  chatBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 100, paddingVertical: 9, alignItems: 'center' },
  chatBtnTxt: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  infoBox: { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center' },
  infoTxt: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
});

// ─────────────────────────────────────────────────
// Worker swipe feed (Подработка)
// ─────────────────────────────────────────────────
function WorkerFeed() {
  const router = useRouter();
  const {
    currentUser, users, vacancies, likes,
    savedIds, optimisticAddSaved,
    refreshAll, refreshLikes, refreshSaved,
    showToast,
  } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  const [dates] = useState(getTodayDates(7));
  const [selectedDate, setSelectedDate] = useState(getTodayDates(7)[0]);
  const [cards, setCards] = useState<Vacancy[]>([]);
  const [history, setHistory] = useState<Record<string, Vacancy[]>>({});
  const [swiping, setSwiping] = useState(false);
  const [detailVacancy, setDetailVacancy] = useState<Vacancy | null>(null);
  const [filterLineId, setFilterLineId] = useState<string | null>(null);
  const [filterPicker, setFilterPicker] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;

  const wantOpacity = pan.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const skipOpacity = pan.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const rotate = pan.x.interpolate({ inputRange: [-SW / 2, 0, SW / 2], outputRange: ['-8deg', '0deg', '8deg'], extrapolate: 'clamp' });

  useEffect(() => {
    if (!currentUser) return;
    const filtered = vacancies
      .filter(v => {
        if (v.status !== 'open') return false;
        if (v.date !== selectedDate) return false;
        if (!currentUser.workTypes?.includes(v.workType)) return false;
        const liked = likes.find(l => l.vacancyId === v.id && l.workerId === currentUser.id);
        if (liked) return false;
        if (filterLineId && v.metroLineId !== filterLineId) return false;
        return true;
      })
      .sort((a, b) => scoreVacancy(b, currentUser) - scoreVacancy(a, currentUser));
    setCards(filtered);
    pan.setValue({ x: 0, y: 0 });
  }, [selectedDate, vacancies, likes, currentUser, filterLineId]);

  const currentCard = cards[0];
  const currentEmployer = currentCard ? users.find(u => u.id === currentCard.employerId) : null;
  const dateHistory = history[selectedDate] ?? [];

  const animateCard = useCallback((dir: 'left' | 'right', velocity: number, cb: () => void) => {
    const targetX = dir === 'right' ? SW * 1.5 : -SW * 1.5;
    const duration = Math.max(180, Math.min(300, 250 / (Math.abs(velocity) + 0.5)));
    setSwiping(true);
    Animated.parallel([
      Animated.timing(pan.x, { toValue: targetX, duration, useNativeDriver: false }),
      Animated.timing(pan.y, { toValue: dir === 'right' ? -40 : 40, duration, useNativeDriver: false }),
    ]).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setSwiping(false);
      cb();
    });
  }, [pan]);

  const snapBack = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      tension: 250,
      friction: 22,
      useNativeDriver: false,
    }).start();
  }, [pan]);

  const doSkip = useCallback((vx = 0.5) => {
    if (!currentCard || !currentUser || swiping) return;
    const card = currentCard;
    const date = selectedDate;
    animateCard('left', vx, async () => {
      await dbUpsertLike(card.id, currentUser.id, card.employerId, {
        workerLiked: false,
        workerSkipped: true,
      });
      await refreshLikes();
      setHistory(h => ({ ...h, [date]: [card, ...(h[date] ?? []).slice(0, 9)] }));
      setCards(prev => prev.slice(1));
    });
  }, [currentCard, currentUser, swiping, selectedDate, animateCard, refreshLikes]);

  const doWant = useCallback((vx = 0.5) => {
    if (!currentCard || !currentUser || swiping) return;
    const card = currentCard;
    const date = selectedDate;
    animateCard('right', vx, async () => {
      await dbUpsertLike(card.id, currentUser.id, card.employerId, {
        workerLiked: true,
        workerSkipped: false,
      });

      const result = await dbCheckAndCreateMatch(card.id, currentUser.id);
      await refreshAll();

      if (result.matched) {
        await notifyWorkerGotMatch(card.company, card.title);
        setHistory(h => ({ ...h, [date]: [card, ...(h[date] ?? []).slice(0, 9)] }));
        router.push({ pathname: '/match', params: { vacancyId: card.id, chatId: result.chatId } });
      } else {
        setHistory(h => ({ ...h, [date]: [card, ...(h[date] ?? []).slice(0, 9)] }));
        setCards(prev => prev.slice(1));
        await notifyWorkerSentApplication(card.title, card.company);
        showToast('Отклик отправлен! Ждём решения работодателя 👍', 'success');
      }
    });
  }, [currentCard, currentUser, swiping, selectedDate, animateCard, refreshAll, router, showToast]);

  const doUndo = useCallback(async () => {
    if (!dateHistory.length || !currentUser || swiping) return;
    const last = dateHistory[0];
    await dbRemoveLike(last.id, currentUser.id);
    await refreshLikes();
    setHistory(h => ({ ...h, [selectedDate]: (h[selectedDate] ?? []).slice(1) }));
    setCards(prev => [last, ...prev]);
    pan.setValue({ x: -SW, y: 0 });
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, tension: 200, friction: 20, useNativeDriver: false }).start();
  }, [dateHistory, selectedDate, currentUser, swiping, refreshLikes, pan]);

  const doSave = useCallback(async () => {
    if (!currentCard || !currentUser) return;
    if (savedIds.includes(currentCard.id)) {
      showToast('Уже в избранном', 'success');
      return;
    }
    optimisticAddSaved(currentCard.id);
    dbAddSaved(currentUser.id, currentCard.id).then(() => {
      refreshSaved().catch(() => {});
    });
    showToast('Сохранено в избранное ❤️', 'success');
  }, [currentCard, currentUser, savedIds, showToast, optimisticAddSaved, refreshSaved]);

  const swipeCbRef = useRef<((dir: 'want' | 'skip', vx: number) => void) | null>(null);
  const snapBackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    swipeCbRef.current = (dir, vx) => { if (dir === 'want') doWant(vx); else doSkip(vx); };
    snapBackRef.current = snapBack;
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, { dx, vx }) => {
        pan.flattenOffset();
        if (dx > SWIPE_THRESHOLD || vx > VELOCITY_THRESHOLD) {
          swipeCbRef.current?.('want', Math.abs(vx));
        } else if (dx < -SWIPE_THRESHOLD || vx < -VELOCITY_THRESHOLD) {
          swipeCbRef.current?.('skip', Math.abs(vx));
        } else {
          snapBackRef.current?.();
        }
      },
      onPanResponderTerminate: () => { snapBackRef.current?.(); },
    })
  ).current;

  const getDateCount = (d: string) => {
    if (!currentUser) return 0;
    return vacancies.filter(v => {
      if (v.status !== 'open') return false;
      if (v.date !== d) return false;
      if (!currentUser.workTypes?.includes(v.workType)) return false;
      const alreadySwiped = likes.find(l => l.vacancyId === v.id && l.workerId === currentUser.id);
      if (alreadySwiped) return false;
      if (filterLineId && v.metroLineId !== filterLineId) return false;
      return true;
    }).length;
  };

  const activeFilterLine = METRO_LINES.find(l => l.id === filterLineId);

  const getRuDay = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()];
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Date strip + inline filter button */}
      <View style={styles.dateStrip}>
        <View style={styles.dateStripInner}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateRow}
            style={{ flex: 1 }}
          >
            {dates.map(d => {
              const active = d === selectedDate;
              const cnt = getDateCount(d);
              return (
                <TouchableOpacity key={d} style={[styles.dateChip, active && styles.dateChipActive]} onPress={() => setSelectedDate(d)} activeOpacity={0.8}>
                  <Text style={[styles.dcDay, active && styles.dcDayActive]}>{getRuDay(d)}</Text>
                  <Text style={[styles.dcNum, active && styles.dcNumActive]}>{new Date(d + 'T00:00:00').getDate()}</Text>
                  <Text style={[styles.dcCnt, active && styles.dcCntActive]}>{cnt}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[pS.inlineFilter, filterLineId ? pS.inlineFilterActive : null]}
            onPress={() => setFilterPicker(true)}
            activeOpacity={0.8}
          >
            {filterLineId && activeFilterLine ? (
              <View style={[pS.filterLineDot, { backgroundColor: activeFilterLine.color }]} />
            ) : (
              <Text style={pS.inlineFilterIcon}>🚇</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Card area */}
      <View style={styles.cardArea}>
        {!currentCard ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 52 }}>😔</Text>
            <Text style={styles.emptyTitle}>Новых вакансий пока нет</Text>
            <Text style={styles.emptySubtitle}>Попробуй другую дату или дождись новых объявлений</Text>
          </View>
        ) : (
          <>
            {cards[2] ? <View style={styles.ghost2} /> : null}
            {cards[1] ? <View style={styles.ghost1} /> : null}

            <Animated.View
              style={[styles.cardAnimated, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] }]}
              {...panResponder.panHandlers}
            >
              <View style={styles.card}>
                <Animated.View style={[styles.wantOverlay, { opacity: wantOpacity }]}>
                  <Text style={styles.wantText}>ХОЧУ ♥</Text>
                </Animated.View>
                <Animated.View style={[styles.skipOverlay, { opacity: skipOpacity }]}>
                  <Text style={styles.skipText}>НЕТ ✕</Text>
                </Animated.View>

                <View style={styles.cardTapArea}>
                  <View style={styles.cardTop}>
                    <View style={styles.companyRow}>
                      {currentEmployer?.avatarUrl ? (
                        <Image source={{ uri: currentEmployer.avatarUrl }} style={styles.avatarImg} contentFit="cover" transition={150} />
                      ) : (
                        <View style={[styles.avatar, { backgroundColor: nameColorFromString(currentCard.employerId) }]}>
                          <Text style={styles.avatarText}>{(currentCard.company[0] ?? '?').toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.companyName} numberOfLines={1}>{currentCard.company}</Text>
                        <Text style={styles.metroHint}>🚇 {currentCard.metroStation}</Text>
                      </View>
                      {currentCard.isUrgent ? (
                        <View style={styles.urgentTag}><Text style={styles.urgentTagTxt}>🔥 Срочно</Text></View>
                      ) : null}
                    </View>

                    <Text style={styles.jobTitle} numberOfLines={2}>{currentCard.title}</Text>

                    <View style={styles.chipsRow}>
                      <Chip label={`⏰ ${currentCard.timeStart}–${currentCard.timeEnd}`} variant="time" />
                      <Chip label={`📅 ${formatDate(currentCard.date)}`} variant="date" />
                      {currentCard.noExperienceNeeded ? <Chip label="🎓 Без опыта" variant="exp" /> : null}
                    </View>

                    {currentCard.address ? (
                      <View style={styles.addressChip}>
                        <Text style={styles.addressChipIcon}>📍</Text>
                        <Text style={styles.addressChipText} numberOfLines={2}>{currentCard.address}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardMiddle}>
                    <View style={styles.slotsRow}>
                      <View style={styles.slotInfo}>
                        <Text style={styles.slotLabel}>Мест осталось</Text>
                        <Text style={styles.slotValue}>{Math.max(0, currentCard.workersNeeded - currentCard.workersFound)}</Text>
                      </View>
                      <View style={styles.slotInfo}>
                        <Text style={styles.slotLabel}>Всего мест</Text>
                        <Text style={styles.slotValue}>{currentCard.workersNeeded}</Text>
                      </View>
                      <View style={styles.slotInfo}>
                        <Text style={styles.slotLabel}>Занято</Text>
                        <Text style={[styles.slotValue, { color: Colors.primary }]}>{currentCard.workersFound}</Text>
                      </View>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.min(100, (currentCard.workersFound / currentCard.workersNeeded) * 100)}%` }]} />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.detailHintRow}
                    activeOpacity={0.7}
                    onPress={() => setDetailVacancy(currentCard)}
                  >
                    <Text style={styles.detailHintText}>Подробности и нормативы</Text>
                    <Text style={styles.detailHintArrow}>→</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>

            {/* Action buttons outside card */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionUndo, !dateHistory.length && { opacity: 0.3 }]}
                onPress={doUndo}
                disabled={!dateHistory.length || swiping}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.actionUndoIcon}>↩</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionSkip]}
                onPress={() => doSkip(0.5)}
                disabled={swiping}
                activeOpacity={0.7}
              >
                <Text style={styles.actionSkipIcon}>✕</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionSave]}
                onPress={doSave}
                activeOpacity={0.7}
              >
                <Text style={styles.actionSaveIcon}>
                  {savedIds.includes(currentCard.id) ? '❤️' : '🤍'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionWant]}
                onPress={() => doWant(0.5)}
                disabled={swiping}
                activeOpacity={0.7}
              >
                <Text style={styles.actionWantIcon}>✓</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Metro filter overlay */}
      {filterPicker ? (
        <View style={styles.filterOverlay}>
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Фильтр по линии метро</Text>
              <TouchableOpacity onPress={() => setFilterPicker(false)}>
                <Text style={styles.filterClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {filterLineId ? (
              <TouchableOpacity style={styles.clearFilterRow} onPress={() => { setFilterLineId(null); setFilterPicker(false); }}>
                <Text style={styles.clearFilterTxt}>✕ Сбросить фильтр</Text>
              </TouchableOpacity>
            ) : null}
            <ScrollView showsVerticalScrollIndicator={false}>
              {METRO_LINES.map((l: any) => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.lineRow, filterLineId === l.id ? styles.lineRowActive : null]}
                  onPress={() => { setFilterLineId(l.id); setFilterPicker(false); }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.lineDot, { backgroundColor: l.color }]} />
                  <Text style={[styles.lineName, filterLineId === l.id ? { color: Colors.primary, fontWeight: '700' } : null]}>{l.name}</Text>
                  {filterLineId === l.id ? <Text style={{ color: Colors.primary }}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* Detail modal */}
      <VacancyDetailModal
        vacancy={detailVacancy}
        visible={!!detailVacancy}
        onClose={() => setDetailVacancy(null)}
        actions={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={styles.detailSkipBtn}
              onPress={() => { setDetailVacancy(null); doSkip(0.5); }}
              activeOpacity={0.8}
            >
              <Text style={styles.detailSkipTxt}>✕ Не подходит</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.detailWantBtn}
              onPress={() => { setDetailVacancy(null); doWant(0.5); }}
              activeOpacity={0.8}
            >
              <Text style={styles.detailWantTxt}>♥ Хочу!</Text>
            </TouchableOpacity>
          </View>
        }
      />


    </View>
  );
}

// ─────────────────────────────────────────────────
// Worker Permanent mode
// ─────────────────────────────────────────────────
type PermTab = 'open' | 'applied' | 'rejected' | 'saved';

const SALARY_CHIPS = [
  { label: 'Любая', value: 0 },
  { label: '30 000+', value: 30000 },
  { label: '50 000+', value: 50000 },
  { label: '80 000+', value: 80000 },
  { label: '100 000+', value: 100000 },
];

function WorkerPermMode() {
  const router = useRouter();
  const {
    currentUser, permVacancies, permApplications,
    permSavedIds, optimisticAddPermSaved, optimisticRemovePermSaved,
    refreshPermVacancies, refreshPermApplications, refreshPermSaved,
    showToast,
  } = useApp();

  const [tab, setTab] = useState<PermTab>('open');
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterLineId, setFilterLineId] = useState<string | null>(null);
  const [filterPicker, setFilterPicker] = useState(false);
  const [minSalary, setMinSalary] = useState(0);
  const [applying, setApplying] = useState<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshPermVacancies(), refreshPermApplications(), refreshPermSaved()]);
    setRefreshing(false);
  };

  if (!currentUser) return null;

  const myApps = permApplications.filter(a => a.workerId === currentUser.id);
  const myAppVacIds = new Set(myApps.map(a => a.vacancyId));
  const getAppStatus = (vacId: string) => myApps.find(a => a.vacancyId === vacId)?.status ?? null;

  const matchesSearch = (v: PermVacancy) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return v.title.toLowerCase().includes(q) || v.company.toLowerCase().includes(q);
  };
  const matchesFilters = (v: PermVacancy) => {
    if (filterLineId && v.metroLineId !== filterLineId) return false;
    if (minSalary > 0 && v.salary < minSalary) return false;
    return true;
  };

  // Tab buckets
  const openVacancies     = permVacancies.filter(v => v.status === 'open' && !myAppVacIds.has(v.id) && matchesSearch(v) && matchesFilters(v));
  const appliedVacancies  = permVacancies.filter(v => myAppVacIds.has(v.id) && getAppStatus(v.id) !== 'rejected' && matchesSearch(v) && matchesFilters(v));
  const rejectedVacancies = permVacancies.filter(v => myAppVacIds.has(v.id) && getAppStatus(v.id) === 'rejected' && matchesSearch(v) && matchesFilters(v));
  const savedVacancies    = permVacancies.filter(v => permSavedIds.includes(v.id) && matchesSearch(v) && matchesFilters(v));

  const shownVacancies =
    tab === 'open'     ? openVacancies :
    tab === 'applied'  ? appliedVacancies :
    tab === 'rejected' ? rejectedVacancies :
    savedVacancies;

  const applyTo = async (v: PermVacancy) => {
    if (!currentUser) return;
    if (myAppVacIds.has(v.id)) { showToast('Уже откликнулись', 'success'); return; }
    setApplying(v.id);
    try {
      await dbApplyPermVacancy(v.id, currentUser.id, v.employerId);
      await refreshPermApplications();
      showToast('Отклик отправлен! 📨', 'success');
    } catch {
      showToast('Ошибка', 'error');
    } finally {
      setApplying(null);
    }
  };

  const toggleSave = async (v: PermVacancy) => {
    if (!currentUser) return;
    if (permSavedIds.includes(v.id)) {
      optimisticRemovePermSaved(v.id);
      dbRemovePermSaved(currentUser.id, v.id).catch(() => {});
      showToast('Удалено из избранного', 'success');
    } else {
      optimisticAddPermSaved(v.id);
      dbAddPermSaved(currentUser.id, v.id).catch(() => {});
      showToast('Сохранено ❤️', 'success');
    }
  };

  const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: '⏳ На рассмотрении', color: '#92400E', bg: '#FFF7ED' },
    approved: { label: '✅ Приглашён',        color: Colors.green, bg: '#D1FAE5' },
    rejected: { label: '✕ Отказ',            color: Colors.red,   bg: '#FEE2E2' },
  };

  const activeFilterLine = METRO_LINES.find(l => l.id === filterLineId);

  const TAB_CONFIG: { key: PermTab; icon: string; label: string; count: number; activeColor: string; activeBg: string }[] = [
    { key: 'open',     icon: '📋', label: 'Открытые',    count: openVacancies.length,     activeColor: '#1D4ED8', activeBg: '#EFF6FF' },
    { key: 'applied',  icon: '📨', label: 'Откликнулся', count: appliedVacancies.length,  activeColor: '#7C3AED', activeBg: '#EDE9FE' },
    { key: 'rejected', icon: '✕',  label: 'Отказали',    count: rejectedVacancies.length, activeColor: Colors.red, activeBg: '#FEE2E2' },
    { key: 'saved',    icon: '❤️', label: 'Избранное',   count: savedVacancies.length,    activeColor: Colors.primary, activeBg: Colors.primaryLight },
  ];

  const renderPerm = ({ item: v }: { item: PermVacancy }) => {
    const isApplied = myAppVacIds.has(v.id);
    const isSaved = permSavedIds.includes(v.id);
    const isApplying = applying === v.id;
    const appStatus = getAppStatus(v.id);
    const statusInfo = appStatus ? STATUS_MAP[appStatus] : null;

    return (
      <TouchableOpacity
        style={pS.card}
        onPress={() => router.push({ pathname: '/perm-vacancy-detail', params: { vacancyId: v.id } })}
        activeOpacity={0.92}
      >
        {statusInfo ? (
          <View style={[pS.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[pS.statusTxt, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        ) : null}

        <View style={pS.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={pS.jobTitle} numberOfLines={2}>{v.title}</Text>
            <Text style={pS.company}>{v.company}</Text>
          </View>
          <TouchableOpacity
            style={pS.saveBtn}
            onPress={() => toggleSave(v)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={pS.saveBtnIcon}>{isSaved ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>

        <View style={pS.metaRow}>
          {v.metroStation ? <Text style={pS.metaItem}>🚇 {v.metroStation}</Text> : null}
          {v.address ? <Text style={pS.metaItem} numberOfLines={1}>📍 {v.address}</Text> : null}
        </View>

        <View style={pS.tagsRow}>
          <View style={pS.salaryTag}>
            <Text style={pS.salaryTxt}>{v.salary.toLocaleString('ru-RU')} ₽/мес</Text>
          </View>
          <View style={pS.scheduleTag}>
            <Text style={pS.scheduleTxt}>🗓 {v.schedule}</Text>
          </View>
        </View>

        {v.description ? (
          <Text style={pS.desc} numberOfLines={2}>{v.description}</Text>
        ) : null}

        {tab !== 'rejected' ? (
          <TouchableOpacity
            style={[pS.applyBtn, isApplied && pS.applyBtnDone, isApplying && { opacity: 0.6 }]}
            onPress={(e) => { e.stopPropagation?.(); applyTo(v); }}
            disabled={isApplied || isApplying}
            activeOpacity={0.8}
          >
            <Text style={[pS.applyBtnTxt, isApplied && { color: Colors.green }]}>
              {isApplied ? '✓ Отклик отправлен' : 'Откликнуться'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={pS.rejectedInfo}>
            <Text style={pS.rejectedInfoTxt}>Работодатель отказал по этой вакансии</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const currentTabCfg = TAB_CONFIG.find(t => t.key === tab)!;
  const emptyMessages: Record<PermTab, { icon: string; title: string; sub: string }> = {
    open:     { icon: '🔍', title: 'Нет открытых вакансий', sub: 'Попробуйте изменить фильтры' },
    applied:  { icon: '📨', title: 'Нет откликов', sub: 'Откликайтесь на вакансии во вкладке «Открытые»' },
    rejected: { icon: '😔', title: 'Отказов нет', sub: 'Это хорошо! Продолжайте откликаться' },
    saved:    { icon: '❤️', title: 'Нет избранного', sub: 'Сохраняйте понравившиеся вакансии' },
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Search + metro filter */}
      <View style={pS.searchRow}>
        <View style={pS.searchBox}>
          <Text style={pS.searchIcon}>🔍</Text>
          <TextInput
            style={pS.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Поиск вакансий..."
            placeholderTextColor={Colors.textMuted}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={pS.searchClear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[pS.filterBtn, filterLineId ? pS.filterBtnActive : null]}
          onPress={() => setFilterPicker(true)}
          activeOpacity={0.8}
        >
          {filterLineId && activeFilterLine ? (
            <View style={[pS.filterLineDot, { backgroundColor: activeFilterLine.color, width: 14, height: 14, borderRadius: 7 }]} />
          ) : (
            <Text style={pS.filterBtnTxt}>🚇</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Salary chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={pS.salaryChipsRow}
        style={pS.salaryChipsScroll}
      >
        {SALARY_CHIPS.map(chip => (
          <TouchableOpacity
            key={chip.value}
            style={[pS.salaryChip, minSalary === chip.value && pS.salaryChipActive]}
            onPress={() => setMinSalary(chip.value)}
            activeOpacity={0.75}
          >
            <Text style={[pS.salaryChipTxt, minSalary === chip.value && pS.salaryChipTxtActive]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={pS.statusChipsRow}
        style={pS.statusChipsScroll}
      >
        {TAB_CONFIG.map(t => {
          const isActive = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                pS.statusChip,
                isActive && { backgroundColor: t.activeBg, borderColor: t.activeColor },
              ]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <Text style={pS.statusChipIcon}>{t.icon}</Text>
              <Text style={[pS.statusChipLabel, isActive && { color: t.activeColor, fontWeight: '700' }]}>
                {t.label}
              </Text>
              <View style={[
                pS.statusChipBadge,
                isActive ? { backgroundColor: t.activeColor } : { backgroundColor: Colors.textMuted },
              ]}>
                <Text style={pS.statusChipBadgeTxt}>{t.count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {shownVacancies.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48 }}>{emptyMessages[tab].icon}</Text>
          <Text style={styles.emptyTitle}>{emptyMessages[tab].title}</Text>
          <Text style={styles.emptySubtitle}>{emptyMessages[tab].sub}</Text>
        </View>
      ) : (
        <FlatList
          data={shownVacancies}
          keyExtractor={v => v.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
          renderItem={renderPerm}
        />
      )}

      {/* Metro filter overlay */}
      {filterPicker ? (
        <View style={styles.filterOverlay}>
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Фильтр по линии метро</Text>
              <TouchableOpacity onPress={() => setFilterPicker(false)}>
                <Text style={styles.filterClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {filterLineId ? (
              <TouchableOpacity style={styles.clearFilterRow} onPress={() => { setFilterLineId(null); setFilterPicker(false); }}>
                <Text style={styles.clearFilterTxt}>✕ Сбросить фильтр</Text>
              </TouchableOpacity>
            ) : null}
            <ScrollView showsVerticalScrollIndicator={false}>
              {METRO_LINES.map((l: any) => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.lineRow, filterLineId === l.id ? styles.lineRowActive : null]}
                  onPress={() => { setFilterLineId(l.id); setFilterPicker(false); }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.lineDot, { backgroundColor: l.color }]} />
                  <Text style={[styles.lineName, filterLineId === l.id ? { color: Colors.primary, fontWeight: '700' } : null]}>{l.name}</Text>
                  {filterLineId === l.id ? <Text style={{ color: Colors.primary }}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────
// Employer home — combined Shift + Perm
// ─────────────────────────────────────────────────
function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function EmployerHome() {
  const router = useRouter();
  const { currentUser, vacancies, likes, permVacancies, permApplications, refreshVacancies, refreshPermVacancies, refreshPermApplications, refreshAll, showToast } = useApp();
  const [mode, setMode] = useState<AppMode>('shift');
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [workerListModal, setWorkerListModal] = useState<{ vacId: string; type: 'applicants' | 'hired' | 'rejected' } | null>(null);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  const todayISO = getTodayISO();
  const myVacancies = vacancies.filter(v => v.employerId === currentUser?.id);
  const myPermVacancies = permVacancies.filter(v => v.employerId === currentUser?.id);

  useEffect(() => {
    const pastOpen = myVacancies.filter(v => v.status === 'open' && v.date < todayISO);
    if (pastOpen.length === 0) return;
    Promise.all(pastOpen.map(v => dbUpdateVacancy(v.id, { status: 'closed' })))
      .then(() => refreshVacancies())
      .catch(e => console.warn('[EmployerHome] auto-close past vacancies error', e));
  }, [vacancies]);

  const shown = myVacancies.filter(v => {
    if (tab === 'active') return v.status === 'open' && v.date >= todayISO;
    return v.status === 'closed' || (v.status === 'open' && v.date < todayISO);
  });

  const shownPerm = myPermVacancies.filter(v => {
    if (tab === 'active') return v.status === 'open';
    return v.status === 'closed';
  });

  const applicantCount = (vacId: string) =>
    likes.filter(l => l.vacancyId === vacId && l.workerLiked && !l.isMatch && l.employerLiked !== false).length;
  const rejectedCount = (vacId: string) =>
    likes.filter(
      l => l.vacancyId === vacId && (
        l.employerLiked === false ||
        (l.workerLiked === false && l.workerSkipped === true)
      )
    ).length;

  const permApplicantCount = (vacId: string) =>
    permApplications.filter(a => a.vacancyId === vacId).length;

  const closeVacancy = async (id: string) => {
    try {
      await dbUpdateVacancy(id, { status: 'closed' });
      await refreshVacancies();
      showToast('Вакансия закрыта', 'success');
    } catch (e) {
      showToast('Ошибка при закрытии вакансии', 'error');
    } finally {
      setConfirmClose(null);
    }
  };

  const closePermVacancy = async (id: string) => {
    try {
      await dbClosePermVacancy(id);
      await refreshPermVacancies();
      showToast('Вакансия закрыта', 'success');
    } catch {
      showToast('Ошибка', 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={styles.logoB}>Job</Text>
          <Text style={styles.logoO}>Too</Text>
        </Text>
        <TouchableOpacity
          style={mode === 'shift' ? styles.addBtn : [styles.addBtn, { backgroundColor: '#7C3AED' }]}
          onPress={() => router.push(mode === 'shift' ? '/create-vacancy' : '/create-perm-vacancy')}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>＋ {mode === 'shift' ? 'Смена' : 'Вакансия'}</Text>
        </TouchableOpacity>
      </View>

      {/* Mode switcher */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <ModeSwitcher mode={mode} onChange={setMode} />
      </View>

      <View style={styles.tabs}>
        {(['active', 'closed'] as const).map(t => (
          <TouchableOpacity key={t} style={styles.tabItem2} onPress={() => setTab(t)} activeOpacity={0.8}>
            <Text style={[styles.tabLabel2, tab === t && styles.tabLabelActive]}>{t === 'active' ? 'Активные' : 'Закрытые'}</Text>
            {tab === t ? <View style={styles.tabUnderline} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
      >
        {/* Shift mode */}
        {mode === 'shift' ? (
          shown.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 52 }}>📋</Text>
              <Text style={styles.emptyTitle}>Нет активных вакансий</Text>
              <Text style={styles.emptySubtitle}>Создайте первую вакансию</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/create-vacancy')}>
                <Text style={styles.createBtnText}>+ Создать смену</Text>
              </TouchableOpacity>
            </View>
          ) : (
            shown.map(v => (
              <View key={v.id} style={styles.vacCard}>
                <View style={styles.vacTop}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {v.isUrgent ? <View style={styles.urgentBadge}><Text style={styles.urgentText}>🔥</Text></View> : null}
                    <Text style={styles.vacTitle} numberOfLines={1}>{v.title}</Text>
                  </View>
                  <View style={styles.vacTopRight}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => router.push({ pathname: '/create-vacancy', params: { editId: v.id } })}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.editBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
                      onPress={() => setConfirmClose(v.id)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.editBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.vacMeta}>🚇 {v.metroStation} · 📅 {formatDate(v.date)} · ⏰ {v.timeStart}–{v.timeEnd}</Text>
                {v.address ? <Text style={styles.vacAddress}>📍 {v.address}</Text> : null}

                <View style={styles.statsRow}>
                  {[
                    { num: applicantCount(v.id), label: 'Отклики', color: Colors.blue, type: 'applicants' as const },
                    { num: rejectedCount(v.id), label: 'Отклонено', color: Colors.red, type: 'rejected' as const },
                    { num: `${v.workersFound}/${v.workersNeeded}`, label: 'Набрано', color: Colors.green, type: 'hired' as const },
                  ].map((s, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.statBox}
                      onPress={() => setWorkerListModal({ vacId: v.id, type: s.type })}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.statNum, { color: s.color }]}>{s.num}</Text>
                      <Text style={styles.statLabel}>{s.label}</Text>
                      <Text style={styles.statTap}>↗</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.vacProgress}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, (v.workersFound / v.workersNeeded) * 100)}%` }]} />
                </View>
              </View>
            ))
          )
        ) : (
          /* Permanent mode */
          shownPerm.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 52 }}>💼</Text>
              <Text style={styles.emptyTitle}>Нет постоянных вакансий</Text>
              <Text style={styles.emptySubtitle}>Создайте первую вакансию на постоянную работу</Text>
              <TouchableOpacity style={[styles.createBtn, { borderColor: '#7C3AED' }]} onPress={() => router.push('/create-perm-vacancy')}>
                <Text style={[styles.createBtnText, { color: '#7C3AED' }]}>+ Создать вакансию</Text>
              </TouchableOpacity>
            </View>
          ) : (
            shownPerm.map(v => (
              <View key={v.id} style={[styles.vacCard, pS.permVacCard]}>
                <View style={styles.vacTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vacTitle} numberOfLines={1}>{v.title}</Text>
                    <Text style={pS.permCompany}>{v.company}</Text>
                  </View>
                  <View style={styles.vacTopRight}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => router.push({ pathname: '/create-perm-vacancy', params: { editId: v.id } })}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.editBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
                      onPress={() => closePermVacancy(v.id)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.editBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={pS.permMetaRow}>
                  {v.metroStation ? <Text style={styles.vacMeta}>🚇 {v.metroStation}</Text> : null}
                  {v.address ? <Text style={styles.vacAddress}>📍 {v.address}</Text> : null}
                </View>
                <View style={pS.permTagsRow}>
                  <View style={pS.permSalaryTag}>
                    <Text style={pS.permSalaryTxt}>{v.salary.toLocaleString('ru-RU')} ₽/мес</Text>
                  </View>
                  <View style={pS.permScheduleTag}>
                    <Text style={pS.permScheduleTxt}>🗓 {v.schedule}</Text>
                  </View>
                </View>

                {/* Applications stat */}
                <TouchableOpacity
                  style={pS.appStatBtn}
                  onPress={() => router.push({ pathname: '/perm-applications', params: { vacancyId: v.id } })}
                  activeOpacity={0.8}
                >
                  <Text style={pS.appStatNum}>{permApplicantCount(v.id)}</Text>
                  <Text style={pS.appStatLabel}>откликов</Text>
                  <Text style={pS.appStatArrow}>Посмотреть ↗</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* Worker list modal */}
      {workerListModal ? (
        <WorkerListModal
          vacancyId={workerListModal.vacId}
          type={workerListModal.type}
          onClose={() => setWorkerListModal(null)}
        />
      ) : null}

      {confirmClose ? (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Закрыть вакансию?</Text>
            <Text style={styles.confirmBody}>Вакансия будет перемещена в архив</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmClose(null)}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => closeVacancy(confirmClose)}><Text style={styles.confirmBtnText}>Закрыть</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────
// Worker Home (wrapper with mode switcher)
// ─────────────────────────────────────────────────
function WorkerHome() {
  const [mode, setMode] = useState<AppMode>('shift');
  const { currentUser } = useApp();

  if (!currentUser) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={styles.logoB}>Job</Text>
          <Text style={styles.logoO}>Too</Text>
        </Text>
      </View>
      <View style={styles.modeSwitcherRow}>
        <ModeSwitcher mode={mode} onChange={setMode} />
      </View>
      {mode === 'shift' ? <WorkerFeed /> : <WorkerPermMode />}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────
export default function HomeScreen() {
  const { currentUser } = useApp();
  if (!currentUser) return null;
  return currentUser.role === 'worker' ? <WorkerHome /> : <EmployerHome />;
}

// ─────────────────────────────────────────────────
// Permanent mode styles
// ─────────────────────────────────────────────────
const pS = StyleSheet.create({
  filterLineDot: { width: 8, height: 8, borderRadius: 4 },
  inlineFilter: {
    width: 44, height: 44, borderRadius: 12, marginRight: 8,
    borderWidth: 1.5, borderColor: Colors.inputBorder,
    backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  inlineFilterActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inlineFilterIcon: { fontSize: 20 },
  // Worker perm list
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.bg,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  searchClear: { fontSize: 14, color: Colors.textMuted },
  filterBtn: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.inputBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  filterBtnTxt: { fontSize: 18 },
  // Salary chips
  salaryChipsScroll: { flexGrow: 0 },
  salaryChipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  salaryChip: {
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: Colors.inputBorder,
    backgroundColor: Colors.bg,
  },
  salaryChipActive: { borderColor: Colors.green, backgroundColor: '#D1FAE5' },
  salaryChipTxt: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  salaryChipTxtActive: { color: Colors.green },
  // Status filter chips
  statusChipsScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  statusChipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: Colors.inputBorder,
    backgroundColor: Colors.bg,
    flexShrink: 0,
  },
  statusChipIcon: { fontSize: 13, flexShrink: 0 },
  statusChipLabel: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary, flexShrink: 0 },
  statusChipBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  statusChipBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  // Rejected info
  rejectedInfo: {
    backgroundColor: '#FEE2E2', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  rejectedInfoTxt: { fontSize: 13, color: Colors.red, fontWeight: '500', textAlign: 'center' },
  // Vacancy card
  card: { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.card, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  jobTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, lineHeight: 22 },
  company: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  saveBtn: { padding: 4 },
  saveBtnIcon: { fontSize: 22 },
  metaRow: { gap: 2 },
  metaItem: { fontSize: 13, color: Colors.textMuted },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  salaryTag: { backgroundColor: '#D1FAE5', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  salaryTxt: { fontSize: 13, fontWeight: '800', color: Colors.green },
  scheduleTag: { backgroundColor: Colors.surface, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  scheduleTxt: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  desc: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  applyBtn: {
    backgroundColor: '#7C3AED', borderRadius: 100,
    paddingVertical: 12, alignItems: 'center',
  },
  applyBtnDone: { backgroundColor: '#D1FAE5' },
  applyBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  statusTxt: { fontSize: 12, fontWeight: '700' },
  // Employer perm vacancy card
  permVacCard: { borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
  permCompany: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  permMetaRow: { gap: 2 },
  permTagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  permSalaryTag: { backgroundColor: '#D1FAE5', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  permSalaryTxt: { fontSize: 13, fontWeight: '800', color: Colors.green },
  permScheduleTag: { backgroundColor: Colors.surface, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  permScheduleTxt: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  appStatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EDE9FE', borderRadius: 10, padding: 10,
  },
  appStatNum: { fontSize: 20, fontWeight: '800', color: '#7C3AED' },
  appStatLabel: { fontSize: 12, color: '#7C3AED', flex: 1 },
  appStatArrow: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },
});

// ─────────────────────────────────────────────────
// Shared styles (shift mode)
// ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  logo: { fontSize: 20 },
  logoB: { fontWeight: '800', color: Colors.textPrimary },
  logoO: { fontWeight: '800', color: Colors.primary },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  dateStrip: { borderBottomWidth: 1, borderBottomColor: Colors.divider, backgroundColor: Colors.bg },
  dateStripInner: { flexDirection: 'row', alignItems: 'center' },
  dateRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  modeSwitcherRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  dateChip: { minWidth: 52, height: 64, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  dateChipActive: { backgroundColor: Colors.primary },
  dcDay: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', color: Colors.textMuted },
  dcDayActive: { color: '#fff' },
  dcNum: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  dcNumActive: { color: '#fff' },
  dcCnt: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  dcCntActive: { color: 'rgba(255,255,255,0.8)' },

  cardArea: { flex: 1, flexDirection: 'column', paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8 },
  ghost1: { position: 'absolute', left: 10, right: 10, top: 10, bottom: 90, backgroundColor: Colors.bg, borderRadius: Radius.xl, transform: [{ scale: 0.97 }, { translateY: 6 }], opacity: 0.5, ...Shadow.card },
  ghost2: { position: 'absolute', left: 10, right: 10, top: 10, bottom: 90, backgroundColor: Colors.bg, borderRadius: Radius.xl, transform: [{ scale: 0.94 }, { translateY: 12 }], opacity: 0.3, ...Shadow.card },
  cardAnimated: { flex: 1, marginBottom: 8 },
  card: { flex: 1, backgroundColor: Colors.bg, borderRadius: Radius.xl, ...Shadow.strong, overflow: 'hidden' },

  wantOverlay: { position: 'absolute', top: 20, left: 20, zIndex: 10, backgroundColor: Colors.green, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, transform: [{ rotate: '-10deg' }] },
  wantText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  skipOverlay: { position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: Colors.red, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, transform: [{ rotate: '10deg' }] },
  skipText: { color: '#fff', fontSize: 20, fontWeight: '800' },

  cardTapArea: { flex: 1, flexDirection: 'column' },
  cardTop: { padding: 20, paddingBottom: 16, gap: 12 },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarImg: { width: 44, height: 44, borderRadius: 22, flexShrink: 0 },
  avatarText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  companyName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  metroHint: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  urgentTag: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  urgentTagTxt: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  jobTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, lineHeight: 34 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  addressChip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF7ED', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FDBA74',
  },
  addressChipIcon: { fontSize: 15, marginTop: 1 },
  addressChipText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#92400E', lineHeight: 20 },
  cardDivider: { height: 1, backgroundColor: Colors.divider, marginHorizontal: 20 },
  cardMiddle: { padding: 16, paddingHorizontal: 20, gap: 10 },
  slotsRow: { flexDirection: 'row' },
  slotInfo: { flex: 1, alignItems: 'center' },
  slotLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '500', textTransform: 'uppercase', marginBottom: 4 },
  slotValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  progressTrack: { height: 5, backgroundColor: Colors.divider, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  detailHintRow: {
    marginTop: 'auto' as any,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  detailHintText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  detailHintArrow: { fontSize: 14, color: Colors.primary },

  actions: {
    height: 74,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: 16, backgroundColor: 'transparent',
  },
  actionBtn: { borderRadius: 100, alignItems: 'center', justifyContent: 'center', ...Shadow.card },
  actionUndo: { width: 52, height: 52, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.inputBorder },
  actionUndoIcon: { fontSize: 22, color: Colors.textMuted },
  actionSkip: { width: 64, height: 64, backgroundColor: '#FEF2F2', borderWidth: 2, borderColor: Colors.red },
  actionSkipIcon: { fontSize: 26, color: Colors.red, fontWeight: '800' },
  actionSave: { width: 52, height: 52, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.inputBorder },
  actionSaveIcon: { fontSize: 22 },
  actionWant: { width: 64, height: 64, backgroundColor: Colors.primary },
  actionWantIcon: { fontSize: 26, color: '#fff', fontWeight: '800' },

  detailSkipBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.red, borderRadius: 100, paddingVertical: 13, alignItems: 'center' },
  detailSkipTxt: { color: Colors.red, fontSize: 14, fontWeight: '600' },
  detailWantBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 13, alignItems: 'center' },
  detailWantTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 12, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },

  filterOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, justifyContent: 'flex-end' },
  filterSheet: { backgroundColor: Colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '70%' },
  filterSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  filterSheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  filterClose: { fontSize: 18, color: Colors.textMuted, padding: 4 },
  clearFilterRow: { marginHorizontal: 16, marginTop: 12, borderWidth: 1.5, borderColor: Colors.red, borderRadius: 100, paddingVertical: 10, alignItems: 'center' },
  clearFilterTxt: { color: Colors.red, fontSize: 14, fontWeight: '600' },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  lineRowActive: { backgroundColor: Colors.primaryLight },
  lineDot: { width: 12, height: 12, borderRadius: 6 },
  lineName: { flex: 1, fontSize: 15, color: Colors.textPrimary },

  createBtn: { marginTop: 20, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 100, paddingHorizontal: 24, paddingVertical: 10 },
  createBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  tabItem2: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel2: { fontSize: 15, fontWeight: '500', color: Colors.textMuted },
  tabLabelActive: { fontWeight: '700', color: Colors.textPrimary },
  tabUnderline: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: Colors.primary, borderRadius: 1 },
  vacCard: { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.card },
  vacTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  vacTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vacTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  urgentBadge: { backgroundColor: '#FEF3C7', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  urgentText: { fontSize: 12 },
  editBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.inputBorder },
  editBtnText: { fontSize: 14 },
  vacMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  vacAddress: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statBox: { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: 8, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', marginTop: 2 },
  statTap: { fontSize: 9, color: Colors.primary, marginTop: 2 },
  vacProgress: { height: 3, backgroundColor: Colors.divider, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  vacActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  candBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.blue, borderRadius: 100, paddingVertical: 8, alignItems: 'center' },
  candBtnText: { color: Colors.blue, fontSize: 13, fontWeight: '600' },
  deleteBtn: { width: 44, height: 36, borderWidth: 1.5, borderColor: Colors.red, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 16 },
  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { backgroundColor: Colors.bg, borderRadius: Radius.xl, padding: 28, width: '100%', gap: 12 },
  confirmTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', color: Colors.textPrimary },
  confirmBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  confirmBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 100, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: { flex: 1, backgroundColor: Colors.red, borderRadius: 100, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
