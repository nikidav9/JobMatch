import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { Chat } from '@/constants/types';
import { nameColorFromString, getInitials } from '@/services/storage';

export default function ChatsScreen() {
  const router = useRouter();
  const { currentUser, chats, users } = useApp();
  const [search, setSearch] = useState('');

  if (!currentUser) return null;

  const myChats = chats.filter(c =>
    currentUser.role === 'worker' ? c.workerId === currentUser.id : c.employerId === currentUser.id
  );

  const filtered = myChats.filter(c =>
    c.vacTitle.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName.toLowerCase().includes(search.toLowerCase())
  );

  const getOtherName = (chat: Chat) => {
    const otherId = currentUser.role === 'worker' ? chat.employerId : chat.workerId;
    const other = users.find(u => u.id === otherId);
    return other ? `${other.firstName} ${other.lastName}` : chat.companyName;
  };

  const getUnread = (chat: Chat) =>
    currentUser.role === 'worker' ? chat.unreadWorker : chat.unreadEmployer;

  const getLastMsg = (chat: Chat) => {
    const last = chat.messages[chat.messages.length - 1];
    if (!last) return '';
    if (last.senderId === 'system') return last.text;
    return last.text;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Сообщения</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Поиск по чатам..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>💬</Text>
          <Text style={styles.emptyTitle}>Нет сообщений</Text>
          <Text style={styles.emptySubtitle}>Чаты появятся после мэтча</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          renderItem={({ item }) => {
            const name = getOtherName(item);
            const unread = getUnread(item);
            const last = item.messages[item.messages.length - 1];
            const color = nameColorFromString(name);
            return (
              <TouchableOpacity
                style={styles.chatRow}
                onPress={() => router.push({ pathname: '/chat-room', params: { chatId: item.id } })}
                activeOpacity={0.8}
              >
                <View style={[styles.avatar, { backgroundColor: color }]}>
                  <Text style={styles.avatarText}>{getInitials(name)}</Text>
                </View>
                <View style={styles.chatInfo}>
                  <View style={styles.chatTop}>
                    <Text style={styles.chatName}>{name}</Text>
                    {last ? <Text style={styles.chatTime}>{formatTime(last.timestamp)}</Text> : null}
                  </View>
                  <Text style={styles.chatVac}>{item.vacTitle}</Text>
                  <Text style={styles.chatLast} numberOfLines={1}>{getLastMsg(item)}</Text>
                </View>
                {unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  searchInput: {
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 6 },
  chatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chatInfo: { flex: 1 },
  chatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  chatTime: { fontSize: 12, color: Colors.textMuted },
  chatVac: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  chatLast: { fontSize: 13, color: '#374151', marginTop: 2 },
  badge: {
    backgroundColor: Colors.primary, borderRadius: 100,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
