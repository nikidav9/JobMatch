import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useApp } from '@/hooks/useApp';
import { Colors } from '@/constants/theme';

const TRACK_W = 140;

export default function RootScreen() {
  const router = useRouter();
  const { currentUser, loading } = useApp();
  const progress = useRef(new Animated.Value(0)).current;
  const slowAnim = useRef<Animated.CompositeAnimation | null>(null);
  const finishing = useRef(false);
  const [ready, setReady] = useState(false); // true = show onboarding

  // Slow crawl animation while loading
  useEffect(() => {
    slowAnim.current = Animated.sequence([
      Animated.timing(progress, { toValue: TRACK_W * 0.55, duration: 350, useNativeDriver: false }),
      Animated.timing(progress, { toValue: TRACK_W * 0.88, duration: 3500, useNativeDriver: false }),
    ]);
    slowAnim.current.start();
  }, []);

  // When loading ends, dash to 100% then navigate
  useEffect(() => {
    if (loading || finishing.current) return;
    finishing.current = true;
    slowAnim.current?.stop();
    Animated.timing(progress, {
      toValue: TRACK_W,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      if (currentUser) {
        router.replace('/(tabs)');
      } else {
        setReady(true);
      }
    });
  }, [loading, currentUser]);

  // Loading / transition screen
  if (!ready) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.logo}>
            <Text style={styles.logoBlack}>Job</Text>
            <Text style={styles.logoOrange}>Too</Text>
          </Text>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: progress }]} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Onboarding (no user)
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.logo}>
            <Text style={styles.logoBlack}>Job</Text>
            <Text style={styles.logoOrange}>Too</Text>
          </Text>
          <Text style={styles.tagline}>Подработки в Москве · Склад</Text>
        </View>

        <View style={styles.btns}>
          <TouchableOpacity
            style={styles.workerBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/register-worker')}
          >
            <Text style={styles.workerBtnMain}>👷  Ищу подработку</Text>
            <Text style={styles.workerBtnSub}>Кладовщик на склад</Text>
          </TouchableOpacity>

          <View style={{ height: 12 }} />

          <TouchableOpacity
            style={styles.employerBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/register-employer')}
          >
            <Text style={styles.employerBtnMain}>🏢  Ищу работников</Text>
            <Text style={styles.employerBtnSub}>Размещаю смены на склад</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginGray}>Уже есть аккаунт? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.loginLink}>Войти →</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>JobToo v1.1</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 44 },
  logoBlack: { fontWeight: '800', color: Colors.textPrimary },
  logoOrange: { fontWeight: '800', color: Colors.primary },
  track: {
    width: TRACK_W,
    height: 3,
    backgroundColor: Colors.inputBorder,
    borderRadius: 100,
    overflow: 'hidden',
    marginTop: 28,
  },
  fill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 100,
  },

  // Onboarding styles
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: { alignItems: 'center', marginBottom: 56 },
  tagline: { fontSize: 15, color: Colors.textMuted, marginTop: 8 },
  btns: { width: '100%' },
  workerBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  workerBtnMain: { color: '#fff', fontSize: 16, fontWeight: '700' },
  workerBtnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 3 },
  employerBtn: {
    backgroundColor: Colors.bg,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  employerBtnMain: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  employerBtnSub: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  loginRow: { flexDirection: 'row', alignItems: 'center', marginTop: 32 },
  loginGray: { fontSize: 14, color: Colors.textMuted },
  loginLink: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  version: { position: 'absolute', bottom: 20, fontSize: 11, color: Colors.textMuted },
});
