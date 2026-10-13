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
import { ensureLocalStorage, storageDir } from './storage';

export const DEMO_SENIOR_ID = 'demo_senior';
export const DEMO_GUARDIAN_ID = 'demo_guardian';

// 모두 설명을 위해 지어낸 가상의 이야기다. 책으로 엮일 때 문단이 되므로 한 답이 세 문장쯤 되게 쓴다.
const DEMO_RECORDS: Array<[chapterId: string, answer: string, summary: string]> = [
  ['childhood', '어릴 때는 강가 마을에서 자랐어. 여름이면 동네 아이들이랑 물장구를 치다가 해 질 무렵에야 집에 들어갔지. 어머니가 저녁 먹으라고 부르던 소리가 아직도 귀에 남아 있어.', '강가 마을에서 보낸 여름날의 기억'],
  ['childhood', '겨울 아침이면 할머니가 아궁이에 고구마를 구워 주셨어. 손이 시려서 호호 불면서 먹으면 그게 세상에서 제일 맛있었단다. 지금도 군고구마 냄새만 나면 그 부엌이 떠올라.', '할머니의 구운 고구마'],
  ['adolescence', '학교 가는 길에 작은 다리가 하나 있었어. 비 온 다음 날에는 물이 불어서 친구들하고 손을 잡고 건넜지. 그때 같이 건너던 순이라는 친구는 지금도 가끔 생각나.', '비 온 날 다리를 건너던 길'],
  ['youth', '처음 일을 시작한 날은 긴장해서 점심도 못 먹었어. 선배들이 어색해하지 말라고 따뜻한 차를 한 잔 건네 주더라. 그 차 맛이 아직도 기억나.', '첫 출근의 긴장과 따뜻한 차'],
  ['youth', '첫 월급을 받던 날은 집에 가는 길에 빵을 샀어. 봉투를 꼭 쥐고 걸으면서 가족하고 나눠 먹을 생각에 발걸음이 가벼웠지. 어머니가 빵을 반으로 쪼개 우리 셋이 나눠 먹던 게 생각나.', '첫 월급과 빵'],
  ['family_home', '네 아빠를 만난 건 시장 골목이었어. 비가 오는데 우산이 하나뿐이라 같이 쓰자고 하더라. 그렇게 걷다 보니 어느새 집 앞까지 와 있었지.', '시장 골목에서의 첫 만남'],
  ['hobbies', '쉬는 날에는 화분에 물 주는 게 낙이야. 베란다에 제라늄이랑 고무나무가 있는데 꽃이 피면 하루가 다 환해져. 아침마다 잎을 닦아 주면 마음도 같이 맑아지는 것 같아.', '화분과 꽃'],
  ['messages', '너희가 건강하고 서로 아끼면서 살면 나는 바랄 게 없단다. 바쁘더라도 밥은 거르지 말고, 힘들면 언제든 전화해. 엄마는 늘 여기서 기다리고 있을게.', '자녀에게 전하는 말'],
];

// public/demo-photos 는 AI 로 만든 가상 사진이다. 데모 저장소로 복사하고 사진 기록을 만든다.
const DEMO_PHOTOS: Array<[file: string, description: string]> = [
  ['bujeon-market.png', '시장 골목에서 어머니와 장을 보고 돌아오는 사진'],
  ['family-studio.png', '가족이 함께 찍은 스튜디오 사진'],
  ['kimjang-day.png', '온 가족이 모여 김장을 하는 날'],
];

async function seedDemoPhotos() {
  if (await prisma.photo.count({ where: { userId: DEMO_SENIOR_ID } })) return;
  const sourceDir = path.join(config.serverDir, '..', 'public', 'demo-photos');
  for (const [file, description] of DEMO_PHOTOS) {
    const fileName = `demo-${file}`;
    await fs.promises.copyFile(path.join(sourceDir, file), path.join(storageDir('photos'), fileName));
    await prisma.photo.create({
      data: {
        id: `demo_photo_${file.replace(/\.png$/, '')}`,
        userId: DEMO_SENIOR_ID,
        fileKey: `photos/${fileName}`,
        fileName: file,
        mimeType: 'image/png',
        analysisJson: JSON.stringify({ description }),
      },
    });
  }
}

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
  await seedDemoPhotos();
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
