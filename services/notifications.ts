/**
 * Local push notifications for JobToo.
 *
 * KEY RULE: These are LOCAL notifications — they appear on the CURRENT device.
 * So every notification must be meaningful to the person whose device this is.
 *
 * Flow table (who calls what on which device):
 *
 * Event                        | Worker device calls         | Employer device calls
 * -----------------------------|-----------------------------|-----------------------
 * Worker swipes right          | notifyWorkerSentApplication | (nothing — employer sees badge later)
 * Employer approves worker     | (nothing yet)               | notifyEmployerApprovedWorker
 * Both liked → MATCH created   | notifyWorkerGotMatch        | notifyEmployerGotMatch
 * Worker confirms shift        | notifyWorkerConfirmedShift  | notifyEmployerConfirmedShift (wait for both)
 * Employer confirms shift      | (same as above)             | (same as above)
 * Both confirmed → completed   | notifyShiftConfirmedBoth    | notifyShiftConfirmedBoth
 * New chat message received    | notifyNewMessage            | notifyNewMessage
 * Manual remind button         | notifyConfirmShiftReminder  | notifyConfirmShiftReminder
 */

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

// ─── Internal helper ──────────────────────────────────────────────────────────

async function notify(title: string, body: string, type: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, data: { type } },
      trigger: null,
    });
  } catch {
    // Never crash the app due to a notification failure
  }
}

// ─── Worker device notifications ─────────────────────────────────────────────

/**
 * Called on WORKER device after they swipe right on a vacancy.
 * Confirms that their application was sent.
 */
export async function notifyWorkerSentApplication(vacancyTitle: string, company: string): Promise<void> {
  await notify(
    '📤 Отклик отправлен',
    `Вы откликнулись на «${vacancyTitle}» в ${company}. Ждём решения работодателя.`,
    'application_sent'
  );
}

/**
 * Called on WORKER device when a MATCH is created (both sides liked).
 * Worker learns the employer also wants them.
 */
export async function notifyWorkerGotMatch(companyName: string, vacancyTitle: string): Promise<void> {
  await notify(
    '🎉 Мэтч! Вас хотят взять!',
    `${companyName} подтвердили ваш отклик на «${vacancyTitle}». Откройте чат!`,
    'match_worker'
  );
}

/**
 * Called on WORKER device when they've confirmed the shift and we're waiting for employer,
 * OR when both confirmed and shift is complete.
 */
export async function notifyWorkerConfirmedShift(
  vacancyTitle: string,
  bothConfirmed: boolean
): Promise<void> {
  if (bothConfirmed) {
    await notify(
      '✅ Смена подтверждена обеими сторонами!',
      `«${vacancyTitle}» — удачи на смене! Не забудьте оценить работодателя.`,
      'shift_confirmed_both'
    );
  } else {
    await notify(
      '✔ Вы подтвердили выход',
      `Ждём подтверждения работодателя для «${vacancyTitle}».`,
      'shift_confirmed_worker'
    );
  }
}

/**
 * Called on WORKER device when the employer has confirmed (and worker already did).
 * This means both confirmed — shift is go.
 */
export async function notifyWorkerEmployerConfirmed(
  companyName: string,
  vacancyTitle: string
): Promise<void> {
  await notify(
    '✅ Работодатель подтвердил смену!',
    `${companyName} подтвердил вашу смену «${vacancyTitle}». Удачи!`,
    'employer_confirmed_worker'
  );
}

// ─── Employer device notifications ───────────────────────────────────────────

/**
 * Called on EMPLOYER device when a worker applies (swipes right) on their vacancy.
 */
export async function notifyEmployerNewApplicant(
  workerName: string,
  vacancyTitle: string
): Promise<void> {
  await notify(
    '📥 Новый отклик!',
    `${workerName} хочет выйти на смену «${vacancyTitle}». Посмотрите кандидата!`,
    'new_applicant'
  );
}

/**
 * Called on EMPLOYER device when a MATCH is created (employer approved, worker also liked).
 */
export async function notifyEmployerGotMatch(
  workerName: string,
  vacancyTitle: string
): Promise<void> {
  await notify(
    '🎉 Мэтч!',
    `${workerName} готов выйти на смену «${vacancyTitle}». Откройте чат!`,
    'match_employer'
  );
}

/**
 * Called on EMPLOYER device after they confirm the shift.
 */
export async function notifyEmployerConfirmedShift(
  workerName: string,
  vacancyTitle: string,
  bothConfirmed: boolean
): Promise<void> {
  if (bothConfirmed) {
    await notify(
      '✅ Смена подтверждена обеими сторонами!',
      `${workerName} и вы подтвердили смену «${vacancyTitle}». Не забудьте оценить работника.`,
      'shift_confirmed_both'
    );
  } else {
    await notify(
      '✔ Вы подтвердили смену',
      `Ждём подтверждения от ${workerName} для «${vacancyTitle}».`,
      'shift_confirmed_employer'
    );
  }
}

/**
 * Called on EMPLOYER device when the worker has confirmed (and employer already did).
 */
export async function notifyEmployerWorkerConfirmed(
  workerName: string,
  vacancyTitle: string
): Promise<void> {
  await notify(
    '✅ Работник подтвердил выход!',
    `${workerName} подтвердил смену «${vacancyTitle}». Всё готово!`,
    'worker_confirmed_employer'
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

/**
 * New chat message — shown on the RECEIVER's device.
 * Called when polling detects a message from the other party.
 */
export async function notifyNewMessage(senderName: string, preview: string): Promise<void> {
  await notify(
    `💬 ${senderName}`,
    preview.slice(0, 100),
    'message'
  );
}

/**
 * Manual reminder — called on the CURRENT user's device when they tap the 🔔 button.
 * Reminds the current user (not the other side) to confirm.
 */
export async function notifyConfirmShiftReminder(options: {
  role: 'worker' | 'employer';
  vacancyTitle: string;
  date: string;
}): Promise<void> {
  const { role, vacancyTitle, date } = options;
  const body = role === 'worker'
    ? `Не забудьте подтвердить выход на смену «${vacancyTitle}» ${date}`
    : `Не забудьте подтвердить смену «${vacancyTitle}» ${date}`;
  await notify('⏰ Напоминание о смене', body, 'confirm_reminder');
}
