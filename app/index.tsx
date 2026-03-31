import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/hooks/useApp';
import { Colors } from '@/constants/theme';

export default function Onboarding() {
  const router = useRouter();
  const { currentUser, loading } = useApp();

  useEffect(() => {
    if (!loading && currentUser) {
      router.replace('/(tabs)');
    }
  }, [currentUser?.id, loading]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.logo}>
            <Text style={styles.logoBlack}>Job</Text>
            <Text style={styles.logoOrange}>Ty</Text>
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.logo}>
            <Text style={styles.logoBlack}>Job</Text>
            <Text style={styles.logoOrange}>Ty</Text>
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

        <Text style={styles.version}>jobTy v1.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: { alignItems: 'center', marginBottom: 56 },
  logo: { fontSize: 44 },
  logoBlack: { fontWeight: '800', color: Colors.textPrimary },
  logoOrange: { fontWeight: '800', color: Colors.primary },
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
