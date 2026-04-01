import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { METRO_LINES } from '@/constants/metro';
import { nameColorFromString, getInitials } from '@/services/storage';

function StarRow({ rating, count }: { rating: number; count: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(s => (
        <Text key={s} style={[styles.star, rating >= s - 0.4 ? styles.starOn : styles.starOff]}>★</Text>
      ))}
      <Text style={styles.ratingText}>
        {count > 0 ? `${rating.toFixed(1)} · ${count} отзывов` : 'Нет оценок'}
      </Text>
    </View>
  );
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { users } = useApp();

  const user = users.find(u => u.id === userId);
  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Пользователь не найден</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isWorker = user.role === 'worker';
  const color = nameColorFromString(user.id);
  const initials = getInitials(`${user.firstName} ${user.lastName}`);
  const line = METRO_LINES.find(l => l.id === user.metroLineId);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профиль</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar card */}
        <View style={styles.topCard}>
          {user.avatarUrl ? (
            <Image
              source={{ uri: user.avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: color }]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}

          <Text style={styles.name}>{user.firstName} {user.lastName}</Text>

          <View style={[styles.roleBadge, { backgroundColor: isWorker ? Colors.primaryLight : '#FEF3C7' }]}>
            <Text style={[styles.roleText, { color: isWorker ? Colors.primary : '#92400E' }]}>
              {isWorker ? '👤 Работник' : '🏢 Работодатель'}
            </Text>
          </View>

          <StarRow rating={user.avgRating ?? 0} count={user.ratingCount ?? 0} />
        </View>

        {/* Info block */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Основная информация</Text>

          {isWorker ? (
            <>
              {user.metroStation ? (
                <InfoRow label="Метро" value={
                  <View style={styles.metroVal}>
                    {line ? <View style={[styles.lineDot, { backgroundColor: line.color }]} /> : null}
                    <Text style={styles.valText}>{user.metroStation}</Text>
                  </View>
                } />
              ) : null}
              {user.age ? <InfoRow label="Возраст" value={<Text style={styles.valText}>{user.age} лет</Text>} /> : null}
              <InfoRow label="Специализация" value={<Text style={styles.valText}>📦 Кладовщик</Text>} />
            </>
          ) : (
            <>
              {user.company ? <InfoRow label="Компания" value={<Text style={styles.valText}>{user.company}</Text>} /> : null}
            </>
          )}
        </View>

        {/* Bio */}
        {user.bio ? (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{isWorker ? 'О себе' : 'О компании'}</Text>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        ) : null}

        {/* Empty bio placeholder */}
        {!user.bio ? (
          <View style={[styles.infoCard, styles.emptyBio]}>
            <Text style={styles.emptyBioText}>
              {isWorker ? '📝 Работник пока не добавил информацию о себе' : '📝 Компания пока не добавила описание'}
            </Text>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {value}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  backText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500', width: 70 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  scroll: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: Colors.textMuted },
  topCard: {
    backgroundColor: Colors.bg, borderRadius: Radius.xl, padding: 24,
    alignItems: 'center', gap: 8, ...Shadow.card,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontSize: 34, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginTop: 4 },
  roleBadge: { borderRadius: 100, paddingHorizontal: 16, paddingVertical: 5 },
  roleText: { fontSize: 13, fontWeight: '600' },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  star: { fontSize: 20 },
  starOn: { color: '#FBBF24' },
  starOff: { color: '#E5E7EB' },
  ratingText: { fontSize: 13, color: Colors.textMuted, marginLeft: 6 },
  infoCard: {
    backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16,
    gap: 10, ...Shadow.card,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.divider },
  infoLabel: { fontSize: 14, color: Colors.textMuted },
  valText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  metroVal: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineDot: { width: 10, height: 10, borderRadius: 5 },
  bioText: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  emptyBio: { backgroundColor: Colors.surface },
  emptyBioText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, paddingVertical: 8 },
});
