import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { notifyEmployerGotMatch } from '@/services/notifications';
import { dbUpsertLike, dbCheckAndCreateMatch } from '@/services/db';
import { getInitials, nameColorFromString } from '@/services/storage';

export default function CandidatesScreen() {
  const router = useRouter();
  const { vacancyId } = useLocalSearchParams<{ vacancyId: string }>();
  const { currentUser, users, vacancies, likes, refreshAll, showToast } = useApp();
  const [tab, setTab] = useState<'want' | 'matched'>('want');

  const vacancy = vacancies.find(v => v.id === vacancyId);
  if (!vacancy || !currentUser) return null;

  const vacLikes = likes.filter(l => l.vacancyId === vacancyId);
  const wantLikes = vacLikes.filter(l => l.workerLiked && !l.isMatch);
  const matchedLikes = vacLikes.filter(l => l.isMatch);

  const getWorker = (workerId: string) => users.find(u => u.id === workerId);

  const onDecide = async (workerId: string, decide: 'accept' | 'skip') => {
    const like = vacLikes.find(l => l.workerId === workerId);
    if (!like) return;

    if (decide === 'skip') {
      await dbUpsertLike(vacancyId, workerId, currentUser.id, { employerLiked: false });
      await refreshAll();
      showToast('Отклонено', 'success');
      return;
    }

    await dbUpsertLike(vacancyId, workerId, currentUser.id, { employerLiked: true });
    const result = await dbCheckAndCreateMatch(vacancyId, workerId);
    await refreshAll();

    if (result.matched) {
      const worker = getWorker(workerId);
      const workerName = worker ? `${worker.firstName} ${worker.lastName}` : 'Работник';
      // Employer's device: tell the employer they got a match
      await notifyEmployerGotMatch(workerName, vacancy.title);
      showToast(`🎉 Мэтч с ${worker?.firstName ?? 'работником'}! Чат открыт`, 'match');
    } else {
      showToast('Отклик одобрен. Ждём подтверждения работника.', 'success');
    }
  };

  const shown = tab === 'want' ? wantLikes : matchedLikes;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{vacancy.title}</Text>
          <Text style={styles.headerSub}>🚇 {vacancy.metroStation}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {([
          { key: 'want', label: `Хотят (${wantLikes.length})` },
          { key: 'matched', label: `Мэтчи (${matchedLikes.length})` },
        ] as const).map(t => (
          <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)} activeOpacity={0.8}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
            {tab === t.key ? <View style={styles.tabLine} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={shown}
        keyExtractor={l => l.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>{tab === 'want' ? '👀' : '🤝'}</Text>
            <Text style={styles.emptyTitle}>{tab === 'want' ? 'Нет откликов' : 'Нет мэтчей'}</Text>
            <Text style={styles.emptySub}>{tab === 'want' ? 'Работники ещё не откликались' : 'Подтвердите кандидатов во вкладке Хотят'}</Text>
          </View>
        }
        renderItem={({ item: like }) => {
          const worker = getWorker(like.workerId);
          if (!worker) return null;
          const isMatch = like.isMatch;
          const workerColor = nameColorFromString(worker.id);
          const initials = getInitials(`${worker.firstName} ${worker.lastName}`);
          return (
            <View style={styles.card}>
              {/* Tappable worker profile row */}
              <TouchableOpacity
                style={styles.cardTop}
                onPress={() => router.push({ pathname: '/user-profile', params: { userId: worker.id } })}
                activeOpacity={0.8}
              >
                {worker.avatarUrl ? (
                  <Image source={{ uri: worker.avatarUrl }} style={styles.avatar} contentFit="cover" transition={150} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: workerColor }]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.workerName}>{worker.firstName} {worker.lastName}</Text>
                  <Text style={styles.workerMeta}>
                    🚇 {worker.metroStation ?? '—'}
                    {worker.age ? `  ·  ${worker.age} лет` : ''}
                  </Text>
                  {(worker.avgRating ?? 0) > 0 ? (
                    <Text style={styles.workerRating}>⭐ {(worker.avgRating ?? 0).toFixed(1)} ({worker.ratingCount} отз.)</Text>
                  ) : null}
                </View>
                <Text style={styles.profileArrow}>Профиль ›</Text>
              </TouchableOpacity>

              {/* Bio snippet */}
              {worker.bio ? (
                <Text style={styles.bioSnippet} numberOfLines={2}>{worker.bio}</Text>
              ) : null}

              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Специальность</Text>
                  <View style={styles.infoChip}><Text style={styles.infoChipText}>📦 Кладовщик</Text></View>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Телефон</Text>
                  <Text style={[styles.infoVal, isMatch && { color: Colors.primary }]}>
                    {isMatch ? worker.phone : '••••••'}
                  </Text>
                </View>
              </View>

              {isMatch ? (
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => router.push({ pathname: '/(tabs)/chats' })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chatBtnText}>💬 Открыть чат</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.skipBtn} onPress={() => onDecide(like.workerId, 'skip')} activeOpacity={0.8}>
                    <Text style={styles.skipText}>👎 Пропустить</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => onDecide(like.workerId, 'accept')} activeOpacity={0.8}>
                    <Text style={styles.acceptText}>✅ Взять!</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  backBtn: {},
  backText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 14, fontWeight: '500', color: Colors.textMuted },
  tabLabelActive: { fontWeight: '700', color: Colors.textPrimary },
  tabLine: { position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 2, backgroundColor: Colors.primary, borderRadius: 1 },
  list: { padding: 16, gap: 12, paddingBottom: 100 },
  card: { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.card, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  workerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  workerMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  workerRating: { fontSize: 12, color: '#FBBF24', fontWeight: '600', marginTop: 2 },
  profileArrow: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  bioSnippet: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, backgroundColor: Colors.surface, borderRadius: 8, padding: 10 },
  infoGrid: { gap: 8, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoLabel: { fontSize: 13, color: Colors.textMuted },
  infoChip: { backgroundColor: Colors.primaryLight, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  infoChipText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  infoVal: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  actions: { flexDirection: 'row', gap: 10 },
  skipBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 100, paddingVertical: 10, alignItems: 'center' },
  skipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  acceptBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 10, alignItems: 'center' },
  acceptText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  chatBtn: { borderWidth: 1.5, borderColor: Colors.blue, borderRadius: 100, paddingVertical: 10, alignItems: 'center' },
  chatBtnText: { fontSize: 13, fontWeight: '600', color: Colors.blue },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});
