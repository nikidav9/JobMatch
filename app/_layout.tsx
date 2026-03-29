import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AlertProvider } from '@/template';
import { AppProvider, AppContext } from '@/contexts/AppContext';
import { ToastLayer } from '@/components/ui/ToastLayer';
import { requestNotificationPermissions } from '@/services/notifications';

function AuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const ctx = React.useContext(AppContext);
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (!ctx || ctx.loading) return;

    const isProtected =
      pathname.startsWith('/(tabs)') ||
      pathname === '/create-vacancy' ||
      pathname === '/candidates' ||
      pathname === '/chat-room' ||
      pathname === '/match' ||
      pathname === '/rate';

    if (!ctx.currentUser && isProtected && !navigatingRef.current) {
      navigatingRef.current = true;
      // Use requestAnimationFrame to ensure navigation happens after render
      requestAnimationFrame(() => {
        router.replace('/');
        setTimeout(() => { navigatingRef.current = false; }, 1000);
      });
    }
  }, [ctx?.currentUser, ctx?.loading, pathname]);

  return null;
}

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
