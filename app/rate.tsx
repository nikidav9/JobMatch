import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { dbSubmitRatingAndMaybeDelete } from '@/services/db';

export default function RateScreen() {
  const router = useRouter();
  const { likeId, toUserId, toName, vacancyId, role } = useLocalSearchParams<{
    likeId: string;
    toUserId: string;
    toName: string;
    vacancyId: string;
    role: 'worker' | 'employer';
  }>();
  const { currentUser, refreshAll, showToast } = useApp();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);

  const ratingLabel =
    rating === 0 ? 'Нажмите на звезду' :
    rating === 1 ? '😞 Очень плохо' :
    rating === 2 ? '😐 Плохо' :
    rating === 3 ? '😊 Нормально' :
    rating === 4 ? '😃 Хорошо' : '🤩 Отлично!';

  const submit = async () => {
    if (!rating || !currentUser) return;
    setLoading(true);
    try {
      const { bothRated } = await dbSubmitRatingAndMaybeDelete({
        likeId,
        fromUserId: currentUser.id,
        toUserId,
        vacancyId,
        rating,
        role,
        reviewText: review.trim() || undefined,
      });

      await refreshAll();

      if (bothRated) {
        showToast('Оценки выставлены. Мэтч завершён! 🏁', 'success');
      } else {
        showToast('Оценка сохранена! Спасибо 🌟', 'success');
      }
      router.replace('/(tabs)');
    } catch {
      showToast('Ошибка при сохранении', 'error');
    } finally {
      setLoading(false);
    }
  };

  const skip = () => router.replace('/(tabs)');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={skip}>
          <Text style={styles.skipTxt}>Пропустить</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Оценить</Text>
        <View style={{ width: 80 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.emoji}>⭐</Text>
          <Text style={styles.title}>Как прошла смена?</Text>
          <Text style={styles.sub}>
            Оцените {role === 'worker' ? 'работодателя' : 'работника'}:
          </Text>
          <Text style={styles.name}>{toName}</Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(s => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
                <Text style={[styles.star, rating >= s && styles.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.ratingLabel}>{ratingLabel}</Text>

          {rating > 0 ? (
            <View style={styles.reviewBlock}>
              <Text style={styles.reviewTitle}>Короткий отзыв (необязательно)</Text>
              <TextInput
                style={styles.reviewInput}
                value={review}
                onChangeText={setReview}
                placeholder="Напишите пару слов о смене..."
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
            </View>
          ) : null}

          <Text style={styles.note}>
            После того как обе стороны выставят оценку, мэтч будет автоматически завершён.
          </Text>

          <TouchableOpacity
            style={[styles.submitBtn, (!rating || loading) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={!rating || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnTxt}>Отправить оценку</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  skipTxt: { fontSize: 14, color: Colors.textMuted, fontWeight: '500', width: 80 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  content: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 32, gap: 12, flexGrow: 1 },
  emoji: { fontSize: 56 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  sub: { fontSize: 15, color: Colors.textMuted, textAlign: 'center' },
  name: { fontSize: 18, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  stars: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  star: { fontSize: 44, color: Colors.divider },
  starActive: { color: '#FBBF24' },
  ratingLabel: { fontSize: 16, color: Colors.textSecondary, fontWeight: '500', height: 24 },
  reviewBlock: { width: '100%', gap: 8, marginTop: 8 },
  reviewTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  reviewInput: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    fontSize: 14, color: Colors.textPrimary, minHeight: 80,
    borderWidth: 1, borderColor: Colors.inputBorder,
  },
  note: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 8 },
  submitBtn: {
    marginTop: 20, backgroundColor: Colors.primary, borderRadius: 100,
    paddingHorizontal: 40, paddingVertical: 16, width: '100%', alignItems: 'center',
  },
  submitBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
