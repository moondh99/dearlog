// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { maskEmail, normalizeEmail } from './email-address';
import { createGmailOtpSender, getOtpSender, otpMessage } from './otp-sender';

// 실제 Gmail 로는 보내지 않는다. SMTP 연결 설정이 맞게 넘어가는지와, nodemailer 가 만든
// 메일 원문에 인증번호·받는 사람·보내는 사람이 제대로 들어가는지를 확인한다.

const ENV_KEYS = ['OTP_PROVIDER', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'OTP_EMAIL_FROM_NAME', 'OTP_DEV_OUTBOX_PATH'] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.restoreAllMocks();
});

describe('Gmail 인증번호 발송', () => {
  it('앱 비밀번호로 smtp.gmail.com 465(TLS)에 붙는다', async () => {
    const sendMail = vi.fn(async () => ({}));
    const createTransport = vi.fn(() => ({ sendMail }));

    const sender = createGmailOtpSender({ user: 'dearlog.otp@gmail.com', appPassword: 'abcdabcdabcdabcd' }, createTransport);
    await sender.send('family@example.com', '123456');

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'dearlog.otp@gmail.com', pass: 'abcdabcdabcdabcd' },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: { name: 'Dearlog', address: 'dearlog.otp@gmail.com' },
      to: 'family@example.com',
    }));
  });

  it('nodemailer 가 만든 메일 원문에 인증번호와 한글 제목이 제대로 들어간다', async () => {
    // 실제 nodemailer 로 메일 원문을 만들되 네트워크로 보내지는 않는다.
    let raw = '';
    const sender = createGmailOtpSender(
      { user: 'dearlog.otp@gmail.com', appPassword: 'x', fromName: '디어로그' },
      () => {
        const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
        return {
          async sendMail(message) {
            const info = await transport.sendMail(message);
            raw = String((info as { message: Buffer }).message);
            return info;
          },
        };
      },
    );

    await sender.send('family@example.com', '654321');

    expect(raw).toMatch(/^To: family@example\.com$/m);
    expect(raw).toMatch(/^From: =\?UTF-8\?.+<dearlog\.otp@gmail\.com>$/m);
    // 한글 제목은 MIME 인코딩되고 긴 헤더는 여러 줄로 접힌다. 접힌 줄을 잇고, 인코딩된 조각을
    // 바이트로 풀어 이어 붙인다(한 글자가 조각 경계에서 나뉠 수 있다).
    const headers = raw.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, ' ');
    const subjectLine = /^Subject: (.+)$/m.exec(headers)?.[1] ?? '';
    const bytes = [...subjectLine.matchAll(/=\?UTF-8\?([QB])\?([^?]*)\?=/gi)].map(([, kind, body]) =>
      kind.toUpperCase() === 'B'
        ? Buffer.from(body, 'base64')
        : Buffer.from(body.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16))), 'latin1'),
    );
    const decoded = bytes.length ? Buffer.concat(bytes).toString('utf8') : subjectLine;
    expect(decoded).toBe(otpMessage('654321').subject);
    expect(decoded).toContain('654321');
    expect(raw).toContain('654321');
  });

  it('설정이 없거나 앱 비밀번호가 비면 보내지 않는다', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.OTP_PROVIDER;
    expect(getOtpSender()).toBeNull();

    process.env.OTP_PROVIDER = 'gmail';
    process.env.GMAIL_USER = 'dearlog.otp@gmail.com';
    process.env.GMAIL_APP_PASSWORD = '';
    expect(getOtpSender()).toBeNull();

    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    expect(getOtpSender()?.name).toBe('gmail');
  });

  it('dev 는 인증번호를 로컬 파일에 남긴다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dearlog-otp-'));
    process.env.OTP_PROVIDER = 'dev';
    process.env.OTP_DEV_OUTBOX_PATH = path.join(dir, 'outbox.jsonl');

    await getOtpSender()!.send('family@example.com', '111222');

    const [line] = (await fs.readFile(process.env.OTP_DEV_OUTBOX_PATH, 'utf8')).trim().split('\n');
    expect(JSON.parse(line)).toMatchObject({ to: 'family@example.com', subject: otpMessage('111222').subject });
    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe('이메일 주소', () => {
  it('앞뒤 공백과 대소문자를 정리하고, 형식이 틀리면 버린다', () => {
    expect(normalizeEmail('  Family@Example.COM ')).toBe('family@example.com');
    expect(normalizeEmail('family@example')).toBeNull();
    expect(normalizeEmail('family example.com')).toBeNull();
    expect(normalizeEmail('')).toBeNull();
  });

  it('보낸 곳을 알려 줄 때 앞 두 글자만 남기고 가린다', () => {
    expect(maskEmail('mdh0204@gmail.com')).toBe('md*****@gmail.com');
    expect(maskEmail('ab@gmail.com')).toBe('a***@gmail.com');
    expect(maskEmail('a@gmail.com')).toBe('a***@gmail.com');
  });
});
