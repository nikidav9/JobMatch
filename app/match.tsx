import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, SafeAreaView, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';

function Confetti() {
  const colors = [Colors.primary, Colors.blue, Colors.green, Colors.purple, '#FFD700'];
  const dots = Array.from({ length: 20 }).map((_, i) => {
    const anim = useRef(new Animated.Value(0)).current;
    const x = (Math.random() - 0.5) * 300;
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 1200 + Math.random() * 800, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    }, []);
    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 280] });
    const translateX = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, x / 2, x] });
    const opacity = anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.8, 0] });
    return (
      <Animated.View
        key={i}
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          width: 8 + Math.random() * 6,
          height: 8 + Math.random() * 6,
          borderRadius: 100,
          backgroundColor: colors[i % colors.length],
          transform: [{ translateX }, { translateY }],
          opacity,
        }}
      />
    );
  });
  return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300, overflow: 'hidden', pointerEvents: 'none' }}>{dots}</View>;
}

export default function MatchScreen() {
  const router = useRouter();
  const { vacancyId, chatId } = useLocalSearchParams<{ vacancyId: string; chatId: string }>();
  const { currentUser, vacancies, users, chats } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const vac = vacancies.find(v => v.id === vacancyId);
  const employer = users.find(u => u.id === vac?.employerId);

  if (!vac || !currentUser) return null;

  const openChat = () => {
    router.replace('/(tabs)/chats');
    setTimeout(() => {
      if (chatId) router.push({ pathname: '/chat-room', params: { chatId } });
    }, 300);
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <Confetti />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.matchTitle}>Мэтч!</Text>
          <Text style={styles.matchSubtitle}>
            {vac.company} хотят взять вас на смену!
          </Text>

          {/* Contact card */}
          <View style={styles.infoCard}>
            <Text style={styles.cardBadge}>КОНТАКТ</Text>
            <View style={styles.divider} />
            <Text style={styles.contactName}>{employer ? `${employer.firstName} ${employer.lastName}` : vac.company}</Text>
            <Text style={styles.contactPhone}>{employer?.phone ?? '—'}</Text>
          </View>

          {/* Vacancy card */}
          <View style={styles.infoCard}>
            <Text style={styles.cardBadge}>ДЕТАЛИ СМЕНЫ</Text>
            <View style={styles.divider} />
            <Text style={styles.vacTitle}>{vac.title}</Text>
            <Text style={styles.vacMeta}>
              🚇 {vac.metroStation} · 📅 {vac.date} · 💰 {vac.salary.toLocaleString('ru')} ₽
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={openChat}>
            <Text style={styles.primaryBtnText}>💬 Открыть чат</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Продолжить поиск</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  body: { padding: 24, alignItems: 'center', gap: 16, paddingBottom: 40 },
  emoji: { fontSize: 64, marginTop: 20 },
  matchTitle: { fontSize: 38, fontWeight: '800', color: Colors.primary, letterSpacing: -1 },
  matchSubtitle: { fontSize: 15, color: '#374151', textAlign: 'center', lineHeight: 22 },
  infoCard: { width: '100%', backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.card, gap: 8 },
  cardBadge: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: Colors.divider },
  contactName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  contactPhone: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  vacTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  vacMeta: { fontSize: 13, color: '#374151' },
  primaryBtn: {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    width: '100%', backgroundColor: Colors.bg,
    borderRadius: 100, borderWidth: 1.5, borderColor: Colors.inputBorder,
    paddingVertical: 16, alignItems: 'center',
  },
  secondaryBtnText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
});
