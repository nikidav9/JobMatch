import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  iconActive,
  iconInactive,
  label,
  focused,
  badge,
}: {
  iconActive: IoniconName;
  iconInactive: IoniconName;
  label: string;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={styles.tabItem}>
      <View>
        <Ionicons
          name={focused ? iconActive : iconInactive}
          size={24}
          color={focused ? Colors.primary : '#9CA3AF'}
        />
        {badge && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.tabLabel, { color: focused ? Colors.primary : '#9CA3AF' }]}
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { currentUser, unreadCount, likes, vacancies } = useApp();
  const isWorker = currentUser?.role === 'worker';

  const matchBadge = (() => {
    if (!currentUser) return 0;
    if (isWorker) {
      return likes.filter(
        l => l.workerId === currentUser.id && l.workerLiked && l.employerLiked && !l.isMatch
      ).length;
    }
    const myVacIds = vacancies.filter(v => v.employerId === currentUser.id).map(v => v.id);
    return likes.filter(l => myVacIds.includes(l.vacancyId) && l.workerLiked && !l.employerLiked).length;
  })();

  const tabBarHeight = Platform.select({
    ios: insets.bottom + 60,
    android: insets.bottom + 60,
    default: 66,
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: Platform.select({
            ios: insets.bottom + 6,
            android: insets.bottom + 6,
            default: 8,
          }),
          backgroundColor: Colors.bg,
          borderTopWidth: 1,
          borderTopColor: Colors.divider,
        },
        tabBarShowLabel: false,
      }}
    >
      {/* Home: search (worker) or vacancies (employer) */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconActive={isWorker ? 'search' : 'briefcase'}
              iconInactive={isWorker ? 'search-outline' : 'briefcase-outline'}
              label={isWorker ? 'Поиск' : 'Вакансии'}
              focused={focused}
            />
          ),
        }}
      />

      {/* Saved (heart) — workers only */}
      {isWorker ? (
        <Tabs.Screen
          name="saved"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon
                iconActive="heart"
                iconInactive="heart-outline"
                label="Избранное"
                focused={focused}
              />
            ),
          }}
        />
      ) : (
        <Tabs.Screen name="saved" options={{ href: null }} />
      )}

      {/* Matches */}
      <Tabs.Screen
        name="matches"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconActive="people"
              iconInactive="people-outline"
              label="Мэтчи"
              focused={focused}
              badge={matchBadge}
            />
          ),
        }}
      />

      {/* Chats */}
      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconActive="chatbubble"
              iconInactive="chatbubble-outline"
              label="Чаты"
              focused={focused}
              badge={unreadCount}
            />
          ),
        }}
      />

      {/* Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconActive="person"
              iconInactive="person-outline"
              label="Профиль"
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: { alignItems: 'center', gap: 2, minWidth: 52 },
  tabLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  badge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: Colors.primary, borderRadius: 100,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
