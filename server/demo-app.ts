// 발표용 데모 서버. 운영 서버와 따로 뜨고, 접수 제한을 이 서버에서만 푼다.
// 호출하는 쪽(demo.ts, 테스트)이 DATABASE_URL 을 데모 DB 로 정한 뒤에 이 모듈을 import 해야 한다.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { issueAuthToken } from './auth';
import { config } from './config';
import { prisma } from './db';
import { COMMON_QUESTIONS, FIXED_CHAPTERS, MIN_ANSWERS_PER_CHAPTER } from './domain/constants';
import { initLocalDatabase } from './prisma/init';
import { ensureLocalStorage } from './storage';

export const DEMO_SENIOR_ID = 'demo_senior';
export const DEMO_GUARDIAN_ID = 'demo_guardian';

// 모두 설명을 위해 지어낸 가상의 이야기다.
const DEMO_RECORDS: Array<[chapterId: string, answer: string, summary: string]> = [
  ['childhood', '어릴 때는 강가 마을에서 자랐어. 여름이면 동네 아이들이랑 물장구를 치다가 해 질 무렵에야 집에 들어갔지.', '강가 마을에서 보낸 여름날의 기억'],
  ['childhood', '할머니가 아궁이에 구워 주시던 고구마 냄새가 아직도 나. 겨울 아침이면 그게 제일 큰 선물이었어.', '할머니의 구운 고구마'],
  ['youth', '처음 일을 시작한 날은 긴장해서 점심도 못 먹었어. 첫 월급을 받던 날 집에 가는 길에 빵을 샀지. 가족하고 나눠 먹고 싶었거든.', '첫 월급과 빵'],
  ['family_home', '네 아빠를 만난 건 시장 골목이었어. 비가 오는데 우산을 같이 쓰자고 하더라. 그렇게 시작됐지.', '시장 골목에서의 첫 만남'],
  ['hobbies', '쉬는 날에는 화분에 물 주는 게 낙이야. 꽃이 피면 하루가 다 환해져.', '화분과 꽃'],
  ['messages', '너희가 건강하고 서로 아끼면서 살면 나는 바랄 게 없단다. 밥 거르지 말고.', '자녀에게 전하는 말'],
];

async function seedDemoFamily() {
  for (const chapter of FIXED_CHAPTERS) {
    await prisma.chapter.upsert({
      where: { id: chapter.id },
      update: {},
      create: { ...chapter, minAnswerCount: MIN_ANSWERS_PER_CHAPTER },
    });
  }
  for (const [index, [chapterId, text]] of COMMON_QUESTIONS.entries()) {
    const id = `common_${String(index + 1).padStart(2, '0')}`;
    await prisma.question.upsert({
      where: { id },
      update: {},
      create: { id, category: 'common_questions', text, chapterId, status: 'active' },
    });
  }
  await prisma.user.upsert({
    where: { id: DEMO_SENIOR_ID },
    update: {},
    create: {
      id: DEMO_SENIOR_ID, name: '김영자', phoneNumber: '01000000001', role: 'senior',
      birthDecade: '1950년대', preferredName: '어르신', seniorName: '김영자',
      seniorBirthDecade: '1950년대', seniorPreferredName: '어르신', guardianName: '이지은',
    },
  });
  await prisma.user.upsert({
    where: { id: DEMO_GUARDIAN_ID },
    update: {},
    create: {
      id: DEMO_GUARDIAN_ID, name: '이지은', phoneNumber: '01000000002', role: 'guardian',
      preferredName: '지은', guardianName: '이지은', guardianRelationship: '딸', guardianPreferredName: '지은',
    },
  });
  await prisma.guardianSeniorLink.upsert({
    where: { guardianId_seniorId: { guardianId: DEMO_GUARDIAN_ID, seniorId: DEMO_SENIOR_ID } },
    update: {},
    create: { guardianId: DEMO_GUARDIAN_ID, seniorId: DEMO_SENIOR_ID, relationship: '딸' },
  });
  if (await prisma.interviewRecord.count({ where: { userId: DEMO_SENIOR_ID } })) return;
  // 답변은 같은 챕터의 아직 안 쓴 공통 질문에 붙인다. 안 그러면 챕터별 진행도가 어긋난다.
  const free = COMMON_QUESTIONS.map(([chapterId], i) => ({ chapterId, id: `common_${String(i + 1).padStart(2, '0')}` }));
  for (const [index, [chapterId, transcriptText, aiSummary]] of DEMO_RECORDS.entries()) {
    const question = free.splice(free.findIndex((q) => q.chapterId === chapterId), 1)[0];
    await prisma.interviewRecord.create({
      data: {
        id: `demo_record_${index + 1}`,
        userId: DEMO_SENIOR_ID,
        chapterId,
        questionId: question?.id,
        // 데모에는 실제 녹음이 없다. 없는 파일은 서버가 재생 주소를 만들지 않는다.
        audioFileKey: `audio/demo-record-${index + 1}.txt`,
        transcriptText,
        aiSummary,
        recordedAt: new Date(Date.UTC(2026, 5, 1 + index)),
      },
    });
  }
}

export async function createDemoApp({ distDir }: { distDir: string }) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('데모 서버는 운영 환경(NODE_ENV=production)에서 띄우지 않는다.');
  }
  // 운영 DB 를 데모가 건드리지 않도록, 데이터와 저장소가 모두 데모 폴더 안일 때만 뜬다.
  const demoRoot = path.dirname(config.dataDir);
  if (!/demo/.test(path.basename(demoRoot)) || !/demo/.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('데모 서버는 데모 전용 DB/저장소 경로가 설정된 경우에만 뜬다.');
  }
  await ensureLocalStorage();
  await initLocalDatabase();
  await seedDemoFamily();

  const app = express();
  // 로그인 없이 가상 가족의 부모님/보호자로 시작한다. 이 서버의 토큰만 발급한다.
  app.post('/api/demo/session', express.json(), (req, res) => {
    const id = req.body?.role === 'parent' ? DEMO_SENIOR_ID : req.body?.role === 'child' ? DEMO_GUARDIAN_ID : null;
    if (!id) {
      res.status(400).json({ error: "role 은 'parent' 또는 'child' 여야 합니다." });
      return;
    }
    const role = id === DEMO_SENIOR_ID ? 'senior' : 'guardian';
    prisma.user.findUniqueOrThrow({ where: { id } }).then((user) => {
      res.json({ user: { id: user.id, name: user.name, role }, authToken: issueAuthToken({ id, role }) });
    }).catch(() => res.status(500).json({ error: '데모 계정을 찾지 못했습니다.' }));
  });

  // 데모 화면(dist-demo)을 먼저 내준다. 없으면 빌드 안내를 준다.
  const indexHtml = path.join(distDir, 'index.html');
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (!req.accepts('html')) return next();
    if (!fs.existsSync(indexHtml)) {
      res.status(503).type('text/plain').send('데모 화면이 아직 없습니다. npm run demo:build 를 먼저 실행하세요.');
      return;
    }
    res.sendFile(indexHtml);
  });

  // 접수 제한은 이 서버에서만 푼다. 운영 서버(server/index.ts)는 그대로 제한 모드다.
  app.use(createApp({ sampleInquiryOnly: false }));
  return app;
}
