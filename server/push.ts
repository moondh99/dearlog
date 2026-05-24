import webpush from 'web-push';
import { config } from './config';
import { prisma } from './db';

export type PushPayload = {
  title: string;
  body: string;
  type: string;
  url?: string;
  sessionId?: string;
  scheduleId?: string;
  [key: string]: unknown;
};

if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
}

export async function sendWebPush(userId: string, payload: PushPayload) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      // 앱 내부 알림함에서도 푸시 클릭과 같은 동작을 재현할 수 있도록 payload를 보존합니다.
      metadataJson: JSON.stringify(payload),
    },
  });

  if (!config.vapid.publicKey || !config.vapid.privateKey) {
    return { notification, sent: 0, skipped: 'VAPID 키가 없어 앱 내부 알림만 저장했습니다.' };
  }

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, JSON.stringify(payload));
      sent += 1;
    } catch {
      // 만료된 구독은 다음 등록 때 갱신되므로 실패해도 알림 row는 유지합니다.
    }
  }
  return { notification, sent };
}
