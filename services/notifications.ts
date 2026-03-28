import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function notifyMatch(options: {
  companyName: string;
  vacancyTitle: string;
  otherName: string;
  role: 'worker' | 'employer';
}): Promise<void> {
  const { companyName, vacancyTitle, otherName, role } = options;
  const title = '🎉 Мэтч!';
  const body =
    role === 'worker'
      ? `${companyName} хочет взять вас на смену: ${vacancyTitle}`
      : `${otherName} готов выйти на смену: ${vacancyTitle}`;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data: { type: 'match' } },
    trigger: null,
  });
}

export async function notifyNewMessage(senderName: string, preview: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `💬 ${senderName}`,
      body: preview.slice(0, 100),
      sound: true,
      data: { type: 'message' },
    },
    trigger: null,
  });
}

/**
 * Push notification to employer when a new worker applies (workerLiked=true).
 */
export async function notifyNewApplicant(options: {
  workerName: string;
  vacancyTitle: string;
}): Promise<void> {
  const { workerName, vacancyTitle } = options;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📥 Новый отклик!',
      body: `${workerName} откликнулся на вашу вакансию «${vacancyTitle}»`,
      sound: true,
      data: { type: 'applicant' },
    },
    trigger: null,
  });
}
