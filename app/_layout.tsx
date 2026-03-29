import React, { useEffect, useState } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { AlertProvider } from '@/template';
import { AppProvider, AppContext } from '@/contexts/AppContext';
import { ToastLayer } from '@/components/ui/ToastLayer';
import { requestNotificationPermissions } from '@/services/notifications';
import { Colors } from '@/constants/theme';

function AuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const ctx = React.useContext(AppContext);
  const [showRefresh, setShowRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isProtected =
    pathname.startsWith('/(tabs)') ||
    pathname === '/create-vacancy' ||
    pathname === '/candidates' ||
    pathname === '/chat-room' ||
    pathname === '/match' ||
    pathname === '/rate';

  useEffect(() => {
    if (!ctx || ctx.loading) return;
    if (!ctx.currentUser && isProtected) {
      router.replace('/');
      // Show refresh button after short delay as fallback
      const t = setTimeout(() => setShowRefresh(true), 800);
      return () => clearTimeout(t);
    } else {
      setShowRefresh(false);
    }
  }, [ctx?.currentUser?.id, ctx?.loading, pathname]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setShowRefresh(false);
    await new Promise(r => setTimeout(r, 300));
    router.replace('/');
    setRefreshing(false);
  };

  if (showRefresh || refreshing) {
    return (
      <View style={guardStyles.overlay}>
        {refreshing ? (
          <View style={guardStyles.card}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={guardStyles.text}>Выходим...</Text>
          </View>
        ) : (
          <View style={guardStyles.card}>
            <Text style={guardStyles.emoji}>🔄</Text>
            <Text style={guardStyles.title}>Что-то пошло не так</Text>
            <Text style={guardStyles.text}>Нажмите кнопку ниже чтобы обновить</Text>
            <TouchableOpacity style={guardStyles.btn} onPress={handleRefresh} activeOpacity={0.8}>
              <Text style={guardStyles.btnTxt}>Обновить страницу</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return null;
}

const guardStyles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bg, zIndex: 9999,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  card: { alignItems: 'center', gap: 16 },
  emoji: { fontSize: 48 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  text: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 100,
    paddingHorizontal: 32, paddingVertical: 14, marginTop: 8,
  },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default function RootLayout() {
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  return (
    <AlertProvider>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="dark" />
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="register-worker" />
            <Stack.Screen name="register-employer" />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
            <Stack.Screen name="legal" />
            <Stack.Screen name="create-vacancy" />
            <Stack.Screen name="candidates" />
            <Stack.Screen name="chat-room" />
            <Stack.Screen name="match" options={{ presentation: 'modal' }} />
            <Stack.Screen name="rate" options={{ presentation: 'modal' }} />
            <Stack.Screen name="admin" />
          </Stack>
          <ToastLayer />
        </AppProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
