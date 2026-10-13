import fs from 'node:fs/promises';
import path from 'node:path';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import { config } from './config';

// 로그인·가입 인증번호를 보내는 곳. 지금은 계정에 등록된 이메일로 보낸다.
// 문자 업체(솔라피, NCP SENS 등)를 붙일 때는 OtpSender 를 하나 더 구현해 getOtpSender 에
// 분기를 더하고, 받는 곳(destination)을 이메일 대신 휴대폰 번호로 넘기면 된다.
//
// 설정이 없으면 보내지 않는다(fail-closed). NODE_ENV 로 개발/운영을 가르지 않는 이유는
// config.ts 의 인증 설정과 같다. 파일럿 서버는 NODE_ENV 없이 뜨므로, NODE_ENV 가 production
// 이 아닐 때 개발용 발송을 켜면 운영 서버가 인증번호를 로그에 찍게 된다.
export type OtpSender = {
  name: string;
  send(to: string, code: string): Promise<void>;
};

const isTestRun = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

export function otpMessage(code: string) {
  return {
    subject: `[Dearlog] 인증번호 ${code}`,
    text: [
      `Dearlog 인증번호는 ${code}입니다.`,
      '3분 안에 입력해 주세요.',
      '',
      '직접 요청하지 않았다면 이 메일은 무시하셔도 됩니다. 인증번호는 누구에게도 알려 주지 마세요.',
    ].join('\n'),
  };
}

// 개발용 발송이 남기는 파일. QA 스크립트가 같은 기기에서 인증번호를 읽어 가입·로그인을 이어 간다.
export function devOtpOutboxPath() {
  return process.env.OTP_DEV_OUTBOX_PATH || path.join(config.dataDir, 'otp-outbox.jsonl');
}

const devSender: OtpSender = {
  name: 'dev',
  async send(to, code) {
    // 서버 로그나 이 파일을 볼 수 있는 사람은 누구든 로그인할 수 있다. 개발·QA 서버에서만 켠다.
    const { subject, text } = otpMessage(code);
    console.warn(`[otp:dev] ${to} ← ${subject}`);
    const outbox = devOtpOutboxPath();
    await fs.mkdir(path.dirname(outbox), { recursive: true });
    await fs.appendFile(outbox, `${JSON.stringify({ to, subject, text, sentAt: new Date().toISOString() })}\n`);
  },
};

type MailTransport = { sendMail(message: SendMailOptions): Promise<unknown> };
type TransportFactory = (options: {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}) => MailTransport;

// Gmail SMTP. 발송용 Google 계정에 2단계 인증을 켜고 "앱 비밀번호"를 발급해 쓴다.
// 계정 비밀번호는 쓰지 않는다. 개인 Gmail 은 하루 약 500명까지 보낼 수 있다.
export function createGmailOtpSender(
  options: { user: string; appPassword: string; fromName?: string },
  createTransport: TransportFactory = (transportOptions) => nodemailer.createTransport(transportOptions),
): OtpSender {
  const transport = createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: options.user, pass: options.appPassword },
    // nodemailer 기본값은 연결 2분이다. Gmail 에 닿지 못하면 인증번호 요청이 그만큼 멈춰 있게 된다.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return {
    name: 'gmail',
    async send(to, code) {
      const { subject, text } = otpMessage(code);
      await transport.sendMail({
        from: { name: options.fromName || 'Dearlog', address: options.user },
        to,
        subject,
        text,
      });
    },
  };
}

let gmailSender: { key: string; sender: OtpSender } | null = null;

function gmailSenderFromEnv(): OtpSender | null {
  const user = (process.env.GMAIL_USER ?? '').trim();
  // 앱 비밀번호는 Google 화면에 4자리씩 띄어서 보인다. 붙여 넣은 공백은 지운다.
  const appPassword = (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, '');
  if (!user || !appPassword) {
    console.warn('[otp] OTP_PROVIDER=gmail 이지만 GMAIL_USER 또는 GMAIL_APP_PASSWORD 가 비어 있어 인증번호를 보내지 않습니다.');
    return null;
  }
  const fromName = (process.env.OTP_EMAIL_FROM_NAME ?? '').trim();
  const key = `${user}\n${appPassword}\n${fromName}`;
  if (!gmailSender || gmailSender.key !== key) {
    gmailSender = { key, sender: createGmailOtpSender({ user, appPassword, fromName }) };
  }
  return gmailSender.sender;
}

const testOutbox: Array<{ to: string; code: string }> = [];

const testSender: OtpSender = {
  name: 'test',
  async send(to, code) {
    testOutbox.push({ to, code });
  },
};

export function getOtpSender(): OtpSender | null {
  const provider = (process.env.OTP_PROVIDER ?? '').trim().toLowerCase();
  if (provider === 'gmail') return gmailSenderFromEnv();
  if (provider === 'dev') return devSender;
  if (provider === 'test' && isTestRun) return testSender;
  return null;
}

export function lastTestOtpTo(to: string) {
  for (let i = testOutbox.length - 1; i >= 0; i -= 1) {
    if (testOutbox[i].to === to) return testOutbox[i].code;
  }
  return null;
}

export function clearTestOtpOutbox() {
  testOutbox.length = 0;
}
