import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';

// 인증번호 문자를 보내는 곳. 실제 업체(솔라피, NCP SENS 등)는 아직 붙이지 않았다.
// 업체를 붙일 때는 SmsSender 를 구현해 getSmsSender 에 분기를 하나 더하면 된다.
//
// 설정이 없으면 발송하지 않는다(fail-closed). NODE_ENV 로 개발/운영을 가르지 않는 이유는
// config.ts 의 인증 설정과 같다. 파일럿 서버는 NODE_ENV 없이 뜨므로, NODE_ENV 가 production
// 이 아닐 때 개발용 발송을 켜면 운영 서버가 인증번호를 로그에 찍게 된다.
export type SmsSender = {
  name: string;
  send(to: string, text: string): Promise<void>;
};

const isTestRun = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

// 개발용 발송이 남기는 파일. QA 스크립트가 같은 기기에서 인증번호를 읽어 가입·로그인을 이어 간다.
export function devSmsOutboxPath() {
  return process.env.SMS_DEV_OUTBOX_PATH || path.join(config.dataDir, 'sms-outbox.jsonl');
}

const devSender: SmsSender = {
  name: 'dev',
  async send(to, text) {
    // 서버 로그나 이 파일을 볼 수 있는 사람은 누구든 로그인할 수 있다. 개발·QA 서버에서만 켠다.
    console.warn(`[sms:dev] ${to} ← ${text}`);
    const outbox = devSmsOutboxPath();
    await fs.mkdir(path.dirname(outbox), { recursive: true });
    await fs.appendFile(outbox, `${JSON.stringify({ to, text, sentAt: new Date().toISOString() })}\n`);
  },
};

const testOutbox: Array<{ to: string; text: string }> = [];

const testSender: SmsSender = {
  name: 'test',
  async send(to, text) {
    testOutbox.push({ to, text });
  },
};

export function getSmsSender(): SmsSender | null {
  const provider = (process.env.SMS_PROVIDER ?? '').trim().toLowerCase();
  if (provider === 'dev') return devSender;
  if (provider === 'test' && isTestRun) return testSender;
  return null;
}

export function lastTestSmsTo(to: string) {
  for (let i = testOutbox.length - 1; i >= 0; i -= 1) {
    if (testOutbox[i].to === to) return testOutbox[i].text;
  }
  return null;
}

export function clearTestSmsOutbox() {
  testOutbox.length = 0;
}
