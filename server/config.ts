import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
