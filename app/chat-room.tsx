
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput,
  TouchableOpacity, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { Message } from '@/constants/types';
import { nameColorFromString, getInitials, formatDate } from '@/services/storage';
import { dbGetMessages, dbInsertMessage, dbMarkRead, dbIncrementUnread } from '@/services/db';
import { notifyNewMessage } from '@/services/notifications';

const POLL_INTERVAL = 4000;

export default function ChatRoom() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { currentUser, users, chats, vacancies, refreshChats } = useApp();

  // Use ref to keep chat data stable even if chats array momentarily changes
  const chatRef = useRef(chats.find(c => c.id === chatId));
  const foundChat = chats.find(c => c.id === chatId);
  if (foundChat) chatRef.current = foundChat;
  const chat = foundChat ?? chatRef.current;

  const [messages, setMessages] = useState<Message[]>(chat?.messages ?? []);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const lastCountRef = useRef(messages.length);

  const otherId = chat
    ? (currentUser?.role === 'worker' ? chat.employerId : chat.workerId)
    : '';
  const other = users.find(u => u.id === otherId);
  const vacancy = vacancies.find(v => v.id === chat?.vacancyId);
  const otherName = other
    ? `${other.firstName} ${other.lastName}`
    : (chat?.companyName ?? '');
  const otherColor = nameColorFromString(otherName);
  const otherAvatarUrl = other?.avatarUrl;

  // Mark as read on mount
  useEffect(() => {
    if (!chat || !currentUser) return;
    dbMarkRead(chat.id, currentUser.role).catch(() => {});
    refreshChats().catch(() => {});
  }, [chat?.id]);

  // Polling for new messages
  useEffect(() => {
    if (!chat?.id || !currentUser) return;
    const localChatId = chat.id;
    const userId = currentUser.id;
    const role = currentUser.role;

    const poll = async () => {
      try {
        const msgs = await dbGetMessages(localChatId);
        if (msgs.length !== lastCountRef.current) {
          setMessages(msgs);
          const newMsgs = msgs.slice(lastCountRef.current);
          const fromOther = newMsgs.filter(m => m.senderId !== userId && m.senderId !== 'system');
          if (fromOther.length > 0) {
            await notifyNewMessage(otherName, fromOther[fromOther.length - 1].text);
            await dbMarkRead(localChatId, role);
            await refreshChats();
          }
          lastCountRef.current = msgs.length;
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
      } catch (e) {
        console.warn('[ChatRoom] poll error', e);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [chat?.id]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
    }
  }, [messages.length]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !chat || !currentUser) return;
    setSending(true);
    setInput('');
    try {
      const msg = await dbInsertMessage(chat.id, currentUser.id, text);
      setMessages(prev => [...prev, msg]);
      lastCountRef.current += 1;
      const forRole = currentUser.role === 'worker' ? 'employer' : 'worker';
      await dbIncrementUnread(chat.id, forRole);
      await refreshChats();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      console.error('[ChatRoom] sendMessage error', e);
      setInput(text); // Restore input on error
    } finally {
      setSending(false);
    }
  };

  // All hooks are declared above — safe to return early here
  if (!currentUser || !chat) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: Colors.textMuted }}>Чат не найден</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.senderId === 'system') {
      return (
        <View style={styles.systemMsg}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }
    const isMe = item.senderId === currentUser.id;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
        {!isMe ? (
          otherAvatarUrl ? (
            <Image
              source={{ uri: otherAvatarUrl }}
              style={styles.msgAvatar}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={[styles.msgAvatar, { backgroundColor: otherColor, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={styles.msgAvatarText}>{getInitials(otherName)}</Text>
            </View>
          )
        ) : null}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
          <Text style={[styles.timestamp, isMe && styles.timestampMe]}>{formatTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerCenter}
          activeOpacity={0.8}
          onPress={() => otherId ? router.push({ pathname: '/user-profile', params: { userId: otherId } }) : null}
        >
          {otherAvatarUrl ? (
            <Image
              source={{ uri: otherAvatarUrl }}
              style={styles.headerAvatar}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: otherColor, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={styles.headerAvatarText}>{getInitials(otherName)}</Text>
            </View>
          )}
          <View>
            <Text style={styles.headerName}>{otherName}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{chat.vacTitle}</Text>
          </View>
          <Text style={{ fontSize: 16, color: Colors.textMuted, marginLeft: 4 }}>›</Text>
        </TouchableOpacity>
        <View style={{ width: 70 }} />
      </View>

      {/* Vacancy info block */}
      {vacancy ? (
        <View style={styles.vacancyBar}>
          {vacancy.date ? (
            <View style={styles.vacancyItem}>
              <Text style={styles.vacancyIcon}>📅</Text>
              <Text style={styles.vacancyText}>{formatDate(vacancy.date)}</Text>
            </View>
          ) : null}
          {vacancy.timeStart && vacancy.timeEnd ? (
            <View style={styles.vacancyItem}>
              <Text style={styles.vacancyIcon}>⏰</Text>
              <Text style={styles.vacancyText}>{vacancy.timeStart}–{vacancy.timeEnd}</Text>
            </View>
          ) : null}
          {vacancy.address ? (
            <View style={styles.vacancyItem}>
              <Text style={styles.vacancyIcon}>📍</Text>
              <Text style={styles.vacancyText} numberOfLines={1}>{vacancy.address}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Messages + Input */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Написать сообщение..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            activeOpacity={0.8}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  backBtn: {},
  backText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  headerAvatar: { width: 34, height: 34, borderRadius: 17 },
  headerAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  headerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: 11, color: Colors.textMuted, maxWidth: 160 },
  msgList: { padding: 16, gap: 8, paddingBottom: 8 },
  systemMsg: {
    alignSelf: 'center', backgroundColor: Colors.primaryLight,
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6, marginVertical: 8,
  },
  systemText: { fontSize: 13, color: Colors.primary, fontWeight: '600', textAlign: 'center' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 2 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, flexShrink: 0 },
  msgAvatarText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  bubble: { maxWidth: '72%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  timestamp: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  timestampMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.divider, backgroundColor: Colors.bg,
  },
  vacancyBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  vacancyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.bg, borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.divider,
  },
  vacancyIcon: { fontSize: 12 },
  vacancyText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', maxWidth: 160 },
  textInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: Colors.textPrimary, maxHeight: 80,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
