import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { dbSavePushToken, dbGetPushToken, dbGetWorkerTokensByMetro } from '@/services/db';

// Show alerts and play sound for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Android notification channels ───────────────────────────────────────────

export async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('messages', {
      name: 'Сообщения',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync('matches', {
      name: 'Мэтчи',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync('vacancies', {
      name: 'Новые вакансии',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync('default', {
      name: 'Общие',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    }),
  ]);
}

// ─── Token registration ───────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function registerForPushNotifications(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  await setupAndroidChannels();

  try {
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: '5b26bb1e-9e73-4d94-8907-b27e3f66096f',
    })).data;
    await dbSavePushToken(userId, token);
  } catch {
    // Not a physical device or EAS not configured — skip silently
  }
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function pushTo(
  recipientUserId: string,
  title: string,
  body: string,
  type: string,
  channelId = 'default',
  data: Record<string, unknown> = {},
): Promise<void> {
  try {
    const token = await dbGetPushToken(recipientUserId);
    if (!token) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: 'default',
        channelId,
        data: { type, ...data },
        priority: 'high',
        ...(channelId === 'messages' ? { ttl: 60 } : {}),
      }),
    });
  } catch {
    // Never crash the app due to a notification failure
  }
}

// ─── Employer notifications ───────────────────────────────────────────────────

export async function notifyEmployerNewApplicant(
  employerId: string,
  workerName: string,
  vacancyTitle: string,
): Promise<void> {
  await pushTo(
    employerId,
    '📥 Новый отклик!',
    `${workerName} хочет выйти на смену «${vacancyTitle}». Посмотрите кандидата!`,
    'new_applicant',
    'matches',
  );
}

export async function notifyEmployerGotMatch(
  employerId: string,
  workerName: string,
  vacancyTitle: string,
): Promise<void> {
  await pushTo(
    employerId,
    '🎉 Мэтч!',
    `${workerName} готов выйти на смену «${vacancyTitle}». Откройте чат!`,
    'match_employer',
    'matches',
  );
}

export async function notifyEmployerNewMessage(
  employerId: string,
  senderName: string,
  preview: string,
  chatId?: string,
): Promise<void> {
  await pushTo(
    employerId,
    `💬 ${senderName}`,
    preview.slice(0, 100),
    'message',
    'messages',
    chatId ? { chatId } : {},
  );
}

// ─── Worker notifications ─────────────────────────────────────────────────────

export async function notifyWorkerGotMatch(
  workerId: string,
  companyName: string,
  vacancyTitle: string,
): Promise<void> {
  await pushTo(
    workerId,
    '🎉 Мэтч! Вас хотят взять!',
    `${companyName} подтвердили ваш отклик на «${vacancyTitle}». Откройте чат!`,
    'match_worker',
    'matches',
  );
}

export async function notifyWorkerShiftConfirmedByEmployer(
  workerId: string,
  companyName: string,
  vacancyTitle: string,
): Promise<void> {
  await pushTo(
    workerId,
    '✅ Смена подтверждена работодателем',
    `${companyName} подтвердил смену «${vacancyTitle}». Хотите оставить отзыв?`,
    'shift_confirmed_by_employer',
    'default',
  );
}

export async function notifyWorkerNewMessage(
  workerId: string,
  senderName: string,
  preview: string,
  chatId?: string,
): Promise<void> {
  await pushTo(
    workerId,
    `💬 ${senderName}`,
    preview.slice(0, 100),
    'message',
    'messages',
    chatId ? { chatId } : {},
  );
}

// ─── Nearby vacancy broadcast ─────────────────────────────────────────────────

export async function notifyWorkersNearVacancy(params: {
  metroStation: string;
  title: string;
  company: string;
  type: 'shift' | 'permanent';
}): Promise<void> {
  try {
    const { metroStation, title, company, type } = params;
    const workers = await dbGetWorkerTokensByMetro(metroStation);
    if (workers.length === 0) return;

    const notifTitle = type === 'permanent'
      ? '💼 Новая постоянная вакансия рядом!'
      : '⚡ Новая подработка рядом!';
    const body = `${company} ищет сотрудника на «${title}» — м. ${metroStation}`;

    const messages = workers.map(w => ({
      to: w.push_token,
      title: notifTitle,
      body,
      sound: 'default',
      channelId: 'vacancies',
      priority: 'normal',
      data: { type: type === 'permanent' ? 'nearby_perm' : 'nearby_shift' },
    }));

    // Expo Push API accepts batches of up to 100
    for (let i = 0; i < messages.length; i += 100) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    }
  } catch {
    // Never crash the app due to a notification failure
  }
}
