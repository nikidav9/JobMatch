import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput,
  TouchableOpacity, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { Message } from '@/constants/types';
import { nameColorFromString, getInitials, nowISO, uid } from '@/services/storage';
import { dbGetMessages, dbInsertMessage, dbMarkRead, dbIncrementUnread } from '@/services/db';
import { notifyNewMessage } from '@/services/notifications';

const POLL_INTERVAL = 4000;

export default function ChatRoom() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { currentUser, users, chats, refreshChats } = useApp();

  const chat = chats.find(c => c.id === chatId);
  const [messages, setMessages] = useState<Message[]>(chat?.messages ?? []);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const lastCountRef = useRef(messages.length);

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

  const otherId = currentUser.role === 'worker' ? chat.employerId : chat.workerId;
  const other = users.find(u => u.id === otherId);
  const otherName = other ? `${other.firstName} ${other.lastName}` : chat.companyName;
  const otherColor = nameColorFromString(otherName);

  // Mark as read on mount
  useEffect(() => {
    dbMarkRead(chat.id, currentUser.role);
    refreshChats();
  }, []);

  // Polling for new messages
  useEffect(() => {
    const poll = async () => {
      const msgs = await dbGetMessages(chat.id);
      if (msgs.length !== lastCountRef.current) {
        setMessages(msgs);
        const newMsgs = msgs.slice(lastCountRef.current);
        // Notify if new messages from other party and app is open
        const fromOther = newMsgs.filter(m => m.senderId !== currentUser.id && m.senderId !== 'system');
        if (fromOther.length > 0) {
          await notifyNewMessage(otherName, fromOther[fromOther.length - 1].text);
          await dbMarkRead(chat.id, currentUser.role);
          await refreshChats();
        }
        lastCountRef.current = msgs.length;
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [chat.id]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    const msg = await dbInsertMessage(chat.id, currentUser.id, text);
    setMessages(prev => [...prev, msg]);
    lastCountRef.current += 1;
    // Increment unread for other party
    const forRole = currentUser.role === 'worker' ? 'employer' : 'worker';
    await dbIncrementUnread(chat.id, forRole);
    await refreshChats();
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

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
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
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
        <View style={styles.headerCenter}>
          <View style={[styles.headerAvatar, { backgroundColor: otherColor }]}>
            <Text style={styles.headerAvatarText}>{getInitials(otherName)}</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{otherName}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{chat.vacTitle}</Text>
          </View>
        </View>
        <View style={{ width: 70 }} />
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
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
            onSubmitEditing={sendMessage}
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
  headerAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  headerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: 11, color: Colors.textMuted, maxWidth: 160 },
  msgList: { padding: 16, gap: 8, paddingBottom: 8 },
  systemMsg: {
    alignSelf: 'center', backgroundColor: Colors.primaryLight,
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6, marginVertical: 8,
  },
  systemText: { fontSize: 13, color: Colors.primary, fontWeight: '600', textAlign: 'center' },
  msgRow: { flexDirection: 'row', marginVertical: 2 },
  msgRowMe: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
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
  textInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: Colors.textPrimary, maxHeight: 80,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
