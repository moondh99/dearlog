import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
  loadDotenv();
}

const serverDir = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:../data/dearlog.db';
}

export const config = {
  port: Number(process.env.LOCAL_SERVER_PORT ?? 8787),
  publicUrl: process.env.LOCAL_SERVER_PUBLIC_URL ?? 'http://localhost:8787',
  serverDir,
  dataDir: path.join(serverDir, 'data'),
  storageDir: path.join(serverDir, 'storage'),
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  factchat: {
    apiKey: process.env.FACTCHAT_API_KEY ?? '',
    baseUrl: process.env.FACTCHAT_BASE_URL ?? 'https://factchat-cloud.mindlogic.ai/v1/gateway',
    chatModel: process.env.FACTCHAT_CHAT_MODEL ?? 'gpt-5-mini',
    visionModel: process.env.FACTCHAT_VISION_MODEL ?? process.env.FACTCHAT_CHAT_MODEL ?? 'gpt-5-mini',
    writingModel: process.env.FACTCHAT_WRITING_MODEL ?? process.env.FACTCHAT_CHAT_MODEL ?? 'gpt-5-mini',
  },
  auth: {
    tokenSecret: process.env.AUTH_TOKEN_SECRET ?? (process.env.NODE_ENV === 'production' ? '' : 'dearlog-local-dev-secret'),
    tokenTtlSeconds: Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 30),
    allowDevHeaders: process.env.ALLOW_DEV_AUTH_HEADERS === 'true'
      || (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH_HEADERS !== 'false'),
  },
  invitation: {
    ttlDays: Number(process.env.INVITATION_TTL_DAYS ?? 14),
  },
  fileAccess: {
    tokenTtlSeconds: Number(process.env.FILE_ACCESS_TOKEN_TTL_SECONDS ?? 10 * 60),
  },
  aiProxy: {
    requestLimitPerMinute: Number(process.env.AI_PROXY_RATE_LIMIT_PER_MINUTE ?? 60),
    unitLimitPerMinute: Number(process.env.AI_PROXY_UNIT_LIMIT_PER_MINUTE ?? 200000),
    auditRetentionDays: Number(process.env.AI_PROXY_AUDIT_RETENTION_DAYS ?? 30),
    alertErrorRatePercent: Number(process.env.AI_PROXY_ALERT_ERROR_RATE_PERCENT ?? 25),
    alertRateLimitedCount: Number(process.env.AI_PROXY_ALERT_RATE_LIMITED_COUNT ?? 10),
    alertMinRequests: Number(process.env.AI_PROXY_ALERT_MIN_REQUESTS ?? 5),
    alertWindowMinutes: Number(process.env.AI_PROXY_ALERT_WINDOW_MINUTES ?? 60),
    alertNotificationsEnabled: process.env.AI_PROXY_ALERT_NOTIFICATIONS_ENABLED === 'true'
      || (process.env.NODE_ENV !== 'production' && process.env.AI_PROXY_ALERT_NOTIFICATIONS_ENABLED !== 'false'),
    alertNotificationUserIds: process.env.AI_PROXY_ALERT_NOTIFICATION_USER_IDS ?? '',
    alertNotificationCooldownMinutes: Number(process.env.AI_PROXY_ALERT_NOTIFICATION_COOLDOWN_MINUTES ?? 30),
    alertRunbookUrl: process.env.AI_PROXY_ALERT_RUNBOOK_URL ?? '/docs/ai-proxy-ops-runbook.md',
    dashboardEnabled: process.env.AI_PROXY_DASHBOARD_ENABLED === 'true'
      || (process.env.NODE_ENV !== 'production' && process.env.AI_PROXY_DASHBOARD_ENABLED !== 'false'),
    dashboardToken: process.env.AI_PROXY_DASHBOARD_TOKEN ?? '',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    subject: process.env.VAPID_SUBJECT ?? 'mailto:local@dearlog.test',
  },
};
