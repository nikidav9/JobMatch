import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';

const DOCS: Record<string, { title: string; body: string }> = {
  terms: {
    title: 'Пользовательское соглашение',
    body: `JobToo — сервис для поиска и публикации временной работы.

1. Общие положения
Сервис JobToo предоставляет платформу для поиска и публикации временной работы в сфере складской логистики.

2. Обязательства пользователя
Пользователь обязуется:
• Предоставлять корректную и актуальную информацию при регистрации.
• Соблюдать правила платформы и уважать других участников.
• Не использовать платформу в мошеннических или незаконных целях.
• Своевременно информировать работодателя/работника об изменениях.

3. Права сервиса
Сервис оставляет за собой право:
• Блокировать или удалять пользователей и вакансии при нарушении правил.
• Изменять условия соглашения с уведомлением пользователей.
• Прекращать предоставление услуг в случае систематических нарушений.

4. Ответственность
Сервис не несёт ответственности за:
• Действия пользователей на платформе.
• Качество выполненных работ.
• Финансовые споры между работниками и работодателями.

5. Заключение
Любое использование платформы означает согласие с условиями настоящего соглашения. Соглашение вступает в силу с момента регистрации.`,
  },
  privacy: {
    title: 'Политика конфиденциальности',
    body: `Настоящая Политика конфиденциальности описывает, как JobToo обрабатывает персональные данные пользователей.

1. Сбор данных
Мы собираем следующие данные:
• Номер телефона и ФИО при регистрации.
• Информацию о метро и специализации (для работников).
• Информацию о компании (для работодателей).
• Данные о вакансиях и откликах.

2. Использование данных
Собранные данные используются исключительно для:
• Обеспечения работы сервиса и матчинга.
• Улучшения функциональности платформы.
• Статистики и аналитики в обезличенном виде.

3. Хранение данных
Все персональные данные пользователей обрабатываются и хранятся в соответствии с законодательством Российской Федерации (152-ФЗ «О персональных данных»).

4. Передача данных третьим лицам
Сервис обязуется не передавать персональные данные третьим лицам без согласия пользователя, кроме случаев, предусмотренных законом.

5. Защита данных
Мы используем современные методы защиты данных для предотвращения несанкционированного доступа.

6. Права пользователя
Пользователь имеет право:
• Получить информацию о своих данных.
• Запросить изменение или удаление данных.
• Отозвать согласие на обработку данных.`,
  },
  consent: {
    title: 'Согласие на обработку персональных данных',
    body: `Настоящим я, как субъект персональных данных, даю своё согласие на обработку моих персональных данных.

1. Оператор данных
ООО «JobToo» (далее — Оператор).

2. Перечень обрабатываемых данных
• Фамилия, имя.
• Номер мобильного телефона.
• Данные о местоположении (станция метро).
• Данные о специализации и опыте работы.
• Фотография профиля (при наличии).
• Данные о рейтинге и отзывах.

3. Цель обработки
Обработка персональных данных осуществляется в целях:
• Регистрации и идентификации пользователя.
• Обеспечения функционирования сервиса поиска работы.
• Формирования рейтингов и отзывов.

4. Срок действия согласия
Настоящее согласие действует на период использования сервиса JobToo.

5. Отзыв согласия
Пользователь имеет право в любое время отозвать настоящее согласие, обратившись к администрации JobToo по электронной почте или через форму обратной связи в приложении.

6. Последствия отзыва
Отзыв согласия влечёт за собой удаление аккаунта и всех связанных данных.`,
  },
};

export default function LegalScreen() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const content = doc ? DOCS[doc] : null;

  if (!content) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backTxt}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Документ</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: Colors.textMuted }}>Документ не найден</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{content.title}</Text>
        <View style={{ width: 70 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.docTitle}>{content.title}</Text>
        <Text style={styles.docBody}>{content.body}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 70 },
  backTxt: { fontSize: 15, color: '#6B7280', fontWeight: '500' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center' },
  body: { padding: 20, paddingBottom: 40 },
  docTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 16, lineHeight: 26 },
  docBody: { fontSize: 15, color: '#374151', lineHeight: 24 },
});
