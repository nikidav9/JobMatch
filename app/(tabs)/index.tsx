import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  Animated, PanResponder, Dimensions, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { Vacancy } from '@/constants/types';
import { getTodayDates, formatDate, scoreVacancy } from '@/services/storage';
import { METRO_LINES } from '@/constants/metro';
import {
  dbUpsertLike, dbCheckAndCreateMatch, dbRemoveLike, dbAddSaved, dbUpdateVacancy,
} from '@/services/db';
import { notifyWorkerSentApplication, notifyWorkerGotMatch } from '@/services/notifications';
import { Chip } from '@/components/ui/Chip';
import { VacancyDetailModal } from '@/components/feature/VacancyDetailModal';

const { width: SW } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.3;

// ─────────────────────────────────────────────────
// Worker swipe feed
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
  const [history, setHistory] = useState<Vacancy[]>([]);
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
    animateCard('left', vx, async () => {
      await dbUpsertLike(currentCard.id, currentUser.id, currentCard.employerId, {
        workerLiked: false,
        workerSkipped: true,
      });
      await refreshLikes();
      setHistory(h => [currentCard, ...h.slice(0, 9)]);
      setCards(prev => prev.slice(1));
    });
  }, [currentCard, currentUser, swiping, animateCard, refreshLikes]);

  const doWant = useCallback((vx = 0.5) => {
    if (!currentCard || !currentUser || swiping) return;
    animateCard('right', vx, async () => {
      await dbUpsertLike(currentCard.id, currentUser.id, currentCard.employerId, {
        workerLiked: true,
        workerSkipped: false,
      });

      const result = await dbCheckAndCreateMatch(currentCard.id, currentUser.id);
      await refreshAll();

      if (result.matched) {
        // Worker's device: tell the worker they got a match
        await notifyWorkerGotMatch(currentCard.company, currentCard.title);
        router.push({ pathname: '/match', params: { vacancyId: currentCard.id, chatId: result.chatId } });
      } else {
        setCards(prev => prev.slice(1));
        // Worker's device: confirm their application was sent
        await notifyWorkerSentApplication(currentCard.title, currentCard.company);
        showToast('Отклик отправлен! Ждём решения работодателя 👍', 'success');
      }
    });
  }, [currentCard, currentUser, swiping, animateCard, refreshAll, router, users, showToast]);

  const doUndo = useCallback(async () => {
    if (!history.length || !currentUser || swiping) return;
    const last = history[0];
    await dbRemoveLike(last.id, currentUser.id);
    await refreshLikes();
    setHistory(h => h.slice(1));
    setCards(prev => [last, ...prev]);
    pan.setValue({ x: -SW, y: 0 });
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, tension: 200, friction: 20, useNativeDriver: false }).start();
  }, [history, currentUser, swiping, refreshLikes, pan]);

  const doSave = useCallback(async () => {
    if (!currentCard || !currentUser) return;
    if (savedIds.includes(currentCard.id)) {
      showToast('Уже в избранном', 'success');
      return;
    }
    // Optimistic update — instantly updates context.savedIds → all screens re-render
    optimisticAddSaved(currentCard.id);
    // Persist to DB in background (don't await, don't block UI)
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
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={styles.logoB}>Job</Text>
          <Text style={styles.logoO}>Too</Text>
        </Text>
        <TouchableOpacity
          style={[styles.filterBtn, filterLineId ? styles.filterBtnActive : null]}
          onPress={() => setFilterPicker(true)}
          activeOpacity={0.8}
        >
          {filterLineId && activeFilterLine ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[styles.filterLineDot, { backgroundColor: activeFilterLine.color }]} />
              <Text style={styles.filterBtnActiveTxt} numberOfLines={1}>{activeFilterLine.name}</Text>
            </View>
          ) : (
            <Text style={styles.filterBtnTxt}>🚇 Фильтр</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Date strip */}
      <View style={styles.dateStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateRow}
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
      </View>

      {/* Card area — full screen */}
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
              {/* Swipe overlays */}
              <Animated.View style={[styles.wantOverlay, { opacity: wantOpacity }]}>
                <Text style={styles.wantText}>ХОЧУ ♥</Text>
              </Animated.View>
              <Animated.View style={[styles.skipOverlay, { opacity: skipOpacity }]}>
                <Text style={styles.skipText}>НЕТ ✕</Text>
              </Animated.View>

              {/* Card content — no ScrollView to avoid PanResponder conflict */}
              <View style={styles.cardTapArea}>
                {/* Top section: company + metro + urgent */}
                <View style={styles.cardTop}>
                  <View style={styles.companyRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(currentCard.company[0] ?? '?').toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.companyName} numberOfLines={1}>{currentCard.company}</Text>
                      <Text style={styles.metroHint}>🚇 {currentCard.metroStation}</Text>
                    </View>
                    {currentCard.isUrgent ? (
                      <View style={styles.urgentTag}><Text style={styles.urgentTagTxt}>🔥 Срочно</Text></View>
                    ) : null}
                  </View>

                  {/* Job title */}
                  <Text style={styles.jobTitle} numberOfLines={2}>{currentCard.title}</Text>

                  {/* Chips row */}
                  <View style={styles.chipsRow}>
                    <Chip label={`⏰ ${currentCard.timeStart}–${currentCard.timeEnd}`} variant="time" />
                    <Chip label={`📅 ${formatDate(currentCard.date)}`} variant="date" />
                    {currentCard.noExperienceNeeded ? <Chip label="🎓 Без опыта" variant="exp" /> : null}
                  </View>

                  {/* Address */}
                  {currentCard.address ? (
                    <View style={styles.addressRow}>
                      <Text style={styles.addressIcon}>📍</Text>
                      <Text style={styles.addressText} numberOfLines={2}>{currentCard.address}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Divider */}
                <View style={styles.cardDivider} />

                {/* Middle: slots progress */}
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

                {/* Tap hint */}
                <TouchableOpacity
                  style={styles.detailHintRow}
                  activeOpacity={0.7}
                  onPress={() => setDetailVacancy(currentCard)}
                >
                  <Text style={styles.detailHintText}>Подробности и нормативы</Text>
                  <Text style={styles.detailHintArrow}>→</Text>
                </TouchableOpacity>
              </View>

              {/* Action buttons — outside card content, always visible */}
              </View>
            </Animated.View>

            {/* Buttons sit BELOW the card, outside Animated.View so they never get covered */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionUndo, !history.length && { opacity: 0.3 }]}
                onPress={doUndo}
                disabled={!history.length || swiping}
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

      {/* Metro filter */}
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
            <ScrollView>
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
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────
// Employer home
// ─────────────────────────────────────────────────
function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function EmployerHome() {
  const router = useRouter();
  const { currentUser, vacancies, likes, refreshVacancies, refreshAll, showToast } = useApp();
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  const todayISO = getTodayISO();
  const myVacancies = vacancies.filter(v => v.employerId === currentUser?.id);

  // Auto-close past-date vacancies that are still 'open'
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

  const applicantCount = (vacId: string) => likes.filter(l => l.vacancyId === vacId && l.workerLiked && !l.employerLiked).length;
  const matchCount = (vacId: string) => likes.filter(l => l.vacancyId === vacId && l.isMatch).length;

  const closeVacancy = async (id: string) => {
    try {
      await dbUpdateVacancy(id, { status: 'closed' });
      await refreshVacancies();
      showToast('Вакансия закрыта', 'success');
    } catch (e) {
      showToast('Ошибка при закрытии вакансии', 'error');
      console.error('[EmployerHome] closeVacancy error', e);
    } finally {
      setConfirmClose(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={styles.logoB}>Job</Text>
          <Text style={styles.logoO}>Too</Text>
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/create-vacancy')} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>＋ Вакансия</Text>
        </TouchableOpacity>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {shown.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 52 }}>📋</Text>
            <Text style={styles.emptyTitle}>Нет активных вакансий</Text>
            <Text style={styles.emptySubtitle}>Создайте первую вакансию</Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/create-vacancy')}>
              <Text style={styles.createBtnText}>+ Создать вакансию</Text>
            </TouchableOpacity>
          </View>
        ) : (
          shown.map(v => (
            <View key={v.id} style={styles.vacCard}>
              <View style={styles.vacTop}>
                <Text style={styles.vacTitle} numberOfLines={1}>{v.title}</Text>
                <View style={styles.vacTopRight}>
                  {v.isUrgent ? <View style={styles.urgentBadge}><Text style={styles.urgentText}>🔥</Text></View> : null}
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => router.push({ pathname: '/create-vacancy', params: { editId: v.id } })}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.editBtnText}>✏️</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.vacMeta}>🚇 {v.metroStation} · 📅 {formatDate(v.date)} · ⏰ {v.timeStart}–{v.timeEnd}</Text>
              {v.address ? <Text style={styles.vacAddress}>📍 {v.address}</Text> : null}
              <View style={styles.statsRow}>
                {[
                  { num: applicantCount(v.id), label: 'Откликов', color: Colors.blue },
                  { num: matchCount(v.id), label: 'Мэтчей', color: Colors.primary },
                  { num: `${v.workersFound}/${v.workersNeeded}`, label: 'Набрано', color: Colors.green },
                ].map((s, i) => (
                  <View key={i} style={styles.statBox}>
                    <Text style={[styles.statNum, { color: s.color }]}>{s.num}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.vacProgress}>
                <View style={[styles.progressFill, { width: `${Math.min(100, (v.workersFound / v.workersNeeded) * 100)}%` }]} />
              </View>
              {tab === 'active' ? (
                <View style={styles.vacActions}>
                  <TouchableOpacity style={styles.candBtn} onPress={() => router.push({ pathname: '/candidates', params: { vacancyId: v.id } })}>
                    <Text style={styles.candBtnText}>👥 Кандидаты {applicantCount(v.id)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmClose(v.id)}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

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

export default function HomeScreen() {
  const { currentUser } = useApp();
  if (!currentUser) return null;
  return currentUser.role === 'worker' ? <WorkerFeed /> : <EmployerHome />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  logo: { fontSize: 20 },
  logoB: { fontWeight: '800', color: Colors.textPrimary },
  logoO: { fontWeight: '800', color: Colors.primary },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  dateStrip: { borderBottomWidth: 1, borderBottomColor: Colors.divider, backgroundColor: Colors.bg },
  dateRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  dateChip: { minWidth: 52, height: 64, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  dateChipActive: { backgroundColor: Colors.primary },
  dcDay: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', color: Colors.textMuted },
  dcDayActive: { color: '#fff' },
  dcNum: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  dcNumActive: { color: '#fff' },
  dcCnt: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  dcCntActive: { color: 'rgba(255,255,255,0.8)' },

  // Card area: flex column — card flex:1 on top, buttons pinned below
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

  // Top section of card
  cardTop: { padding: 20, paddingBottom: 16, gap: 12 },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 17, fontWeight: '700', color: Colors.primary },
  companyName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  metroHint: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  urgentTag: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  urgentTagTxt: { fontSize: 11, fontWeight: '700', color: '#92400E' },

  jobTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, lineHeight: 34 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  addressIcon: { fontSize: 14, marginTop: 1 },
  addressText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  // Divider
  cardDivider: { height: 1, backgroundColor: Colors.divider, marginHorizontal: 20 },

  // Middle section: slots
  cardMiddle: { padding: 16, paddingHorizontal: 20, gap: 10 },
  slotsRow: { flexDirection: 'row', gap: 0 },
  slotInfo: { flex: 1, alignItems: 'center' },
  slotLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '500', textTransform: 'uppercase', marginBottom: 4 },
  slotValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  progressTrack: { height: 5, backgroundColor: Colors.divider, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },

  // Detail hint row
  detailHintRow: {
    marginTop: 'auto' as any,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  detailHintText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  detailHintArrow: { fontSize: 14, color: Colors.primary },

  // Action buttons row — outside card, pinned to bottom of cardArea
  actions: {
    height: 74,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
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

  filterBtn: { borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 160 },
  filterBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  filterBtnTxt: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  filterBtnActiveTxt: { fontSize: 12, color: Colors.primary, fontWeight: '700', maxWidth: 110 },
  filterLineDot: { width: 8, height: 8, borderRadius: 4 },
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
