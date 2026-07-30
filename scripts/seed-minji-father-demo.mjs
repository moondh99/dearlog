#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });
process.env.DATABASE_URL ||= 'file:../data/dearlog.db';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

const runId = 'demo_bulk_20260607_001';
const guardianId = `${runId}_guardian_kim_yeongja`;
const seniorId = `${runId}_senior_choi_jeonghun`;
const linkId = `${runId}_link_choi_jeonghun`;
const invitationId = `${runId}_invitation_choi_jeonghun`;
const invitationToken = `${runId}_choi_jeonghun_invite`;

const profile = {
  key: 'choi_jeonghun',
  seniorName: '최정훈',
  guardianName: '최민지',
  relationship: '아버지',
  birthDecade: '1940년대',
  hometown: '부산 영도',
  occupation: '조선소 설계 기사',
  schoolHistory: '부산공업고등학교 졸업',
  recordSpaceName: '정훈 아버지의 항구와 도면',
  tone: '차분하고 정확한 설명체',
  counts: {
    childhood: 5,
    adolescence: 5,
    youth: 7,
    family_home: 5,
    hobbies: 4,
    relationships: 4,
    messages: 4,
  },
  photos: [
    ['childhood', '영도 골목', '1951년', '부산 영도', '항구가 내려다보이는 골목에서 찍은 어린 시절 사진'],
    ['adolescence', '공업고 실습실', '1963년', '부산공업고등학교', '제도판 앞에서 친구들과 선 실습실 사진'],
    ['youth', '첫 배 도면', '1972년', '울산 조선소', '첫 선박 설계 도면을 들고 찍은 사진'],
    ['youth', '작업복의 봄', '1978년', '조선소 정문', '작업복 차림으로 퇴근하던 봄날'],
    ['family_home', '새집 입주', '1985년', '부산 사하구', '가족이 처음 마련한 집 앞 사진'],
    ['relationships', '설계팀 단체사진', '1994년', '조선소 설계실', '설계팀 동료들과 함께한 단체사진'],
    ['messages', '항구 산책', '2023년', '부산항', '딸 민지와 함께 항구를 걷던 사진'],
  ],
};

const chapters = [
  { id: 'childhood', order: 1, slug: 'childhood', title: '유년기' },
  { id: 'adolescence', order: 2, slug: 'adolescence', title: '청소년기' },
  { id: 'youth', order: 3, slug: 'youth', title: '청년기' },
  { id: 'family_home', order: 4, slug: 'family-home', title: '가정을 꾸린 이야기' },
  { id: 'hobbies', order: 5, slug: 'hobbies', title: '취미' },
  { id: 'relationships', order: 6, slug: 'relationships', title: '인간관계' },
  { id: 'messages', order: 7, slug: 'messages', title: '전하고 싶은 이야기' },
];

const sceneBank = {
  childhood: [
    { time: '전쟁이 끝난 뒤 첫 봄', place: '부산 영도 골목', people: '어머니와 동생들', object: '깡통 화분', emotion: '조심스러운 안도감', quote: '바다는 매일 달라져도 길은 외워야 한다', action: '골목 끝에서 항구 불빛을 세어 보던 일' },
    { time: '국민학교 3학년 무렵', place: '학교 뒤 언덕', people: '담임 선생님', object: '몽당연필', emotion: '자부심', quote: '자로 그은 선처럼 반듯하게 생각해 보거라', action: '처음 도면 같은 그림을 칭찬받은 순간' },
    { time: '여름 방학 새벽', place: '부두 근처 시장', people: '아버지', object: '나무 상자', emotion: '책임감', quote: '무거운 건 둘이 들면 된다', action: '생선 상자를 함께 나르며 어른의 일을 배운 날' },
  ],
  adolescence: [
    { time: '공업고 입학식 날', place: '비탈길 위 교문', people: '같은 반 친구들', object: '천 가방', emotion: '긴장과 기대', quote: '기계는 거짓말을 안 한다', action: '새 실습복 소매를 접어 올리던 일' },
    { time: '열일곱 살 겨울', place: '제도 실습실', people: '제도 선생님', object: 'T자', emotion: '몰입', quote: '한 선이 틀리면 배가 다르게 간다', action: '밤늦게까지 선 굵기를 고치던 시간' },
    { time: '졸업을 앞둔 봄', place: '부산역 플랫폼', people: '친구 상호', object: '종이 표', emotion: '아쉬움', quote: '각자 다른 조선소에서 다시 만나자', action: '첫 직장을 향해 기차에 오르던 장면' },
  ],
  youth: [
    { time: '스물셋 첫 출근 날', place: '울산 조선소 정문', people: '설계팀 선배', object: '청사진', emotion: '압도감', quote: '종이 위의 선이 바다 위 배가 된다', action: '거대한 선체 옆에서 말을 잃었던 순간' },
    { time: '첫 도면 검토 회의', place: '설계실 긴 책상', people: '기관팀 동료들', object: '계산자', emotion: '긴장', quote: '숫자는 다시 확인해도 손해가 없다', action: '치수를 세 번씩 대조하던 습관' },
    { time: '야근이 이어지던 여름', place: '기숙사 옥상', people: '동료 재호', object: '라디오', emotion: '버팀', quote: '배가 물에 뜨는 날까지는 잠을 줄이자', action: '바닷바람을 맞으며 설계를 다시 생각한 밤' },
  ],
  family_home: [
    { time: '결혼 첫해 추석', place: '부산 작은 전셋집', people: '배우자와 양가 가족', object: '상보', emotion: '서툰 따뜻함', quote: '집도 배처럼 균형을 잡아야 한다', action: '손님이 돌아간 뒤 둘이서 마루를 닦던 일' },
    { time: '민지가 태어난 새벽', place: '산부인과 복도', people: '배우자', object: '분홍 포대기', emotion: '벅참', quote: '이 아이에게는 겁보다 길을 보여 주자', action: '작은 손가락을 조심스레 잡았던 순간' },
    { time: '첫 집을 마련한 날', place: '사하구 아파트 앞', people: '가족', object: '열쇠 꾸러미', emotion: '안정감', quote: '문패를 달면 책임도 함께 단다', action: '현관에 가족 이름을 붙이던 오후' },
  ],
  hobbies: [
    { time: '퇴근 후 저녁', place: '집 베란다 작업대', people: '어린 민지', object: '나무 배 모형', emotion: '즐거움', quote: '작은 배도 균형이 맞아야 오래 간다', action: '딸에게 사포질을 맡기던 시간' },
    { time: '쉰다섯 살 무렵', place: '항구 방파제', people: '동료들', object: '낚싯대', emotion: '여유', quote: '물때를 기다리는 것도 일의 일부다', action: '말없이 찌를 바라보던 오후' },
    { time: '주말 아침', place: '동네 도서관', people: '혼자', object: '선박 역사책', emotion: '호기심', quote: '배는 시대의 표정도 싣고 간다', action: '낡은 설계 사진을 오래 들여다본 일' },
  ],
  relationships: [
    { time: '대형 프로젝트가 막히던 해', place: '설계실', people: '후배 기사들', object: '수정 도면', emotion: '연대감', quote: '문제는 사람을 탓하기 전에 구조를 먼저 보자', action: '후배들과 밤새 원인을 나누어 찾던 일' },
    { time: '정년을 앞둔 겨울', place: '회사 식당', people: '오랜 동료들', object: '스테인리스 식판', emotion: '고마움', quote: '우리가 그은 선들이 바다를 꽤 많이 건넜다', action: '동료들과 조용히 밥을 나누던 점심' },
    { time: '오래된 친구를 만난 날', place: '부산역 대합실', people: '공업고 친구 상호', object: '낡은 수첩', emotion: '반가움', quote: '선은 달라도 결국 같은 바다로 갔다', action: '서로의 가족 이야기를 꺼내던 시간' },
  ],
  messages: [
    { time: '최근 항구 산책길', place: '부산항 산책로', people: '딸 민지', object: '흰 등대', emotion: '담담한 애정', quote: '멀리 보려면 먼저 발밑을 단단히 해야 한다', action: '민지에게 일과 가족 이야기를 차분히 들려준 날' },
    { time: '건강검진을 다녀온 오후', place: '거실 창가', people: '배우자', object: '검진 봉투', emotion: '차분함', quote: '남은 시간도 설계하듯이 아끼며 쓰자', action: '가족에게 남길 말을 수첩에 적기 시작한 일' },
    { time: '혼자 사진을 정리한 밤', place: '책상 앞', people: '가족 사진 속 사람들', object: '앨범', emotion: '그리움', quote: '배는 떠나도 항로는 남는다', action: '민지에게 보여 줄 사진을 따로 골라 둔 시간' },
  ],
};

function dateDaysAgo(days, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function eventDateDaysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function stableVector(input, dimensions = 12) {
  const hash = crypto.createHash('sha256').update(input).digest();
  return Array.from({ length: dimensions }, (_, index) => Number(((hash[index] / 255) * 2 - 1).toFixed(6)));
}

function photoSvg(photo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <rect width="900" height="1200" fill="#e8eef2"/>
  <rect x="64" y="64" width="772" height="1072" rx="32" fill="#f9f4ea" stroke="#31465a" stroke-width="8"/>
  <rect x="120" y="170" width="660" height="520" rx="24" fill="#9eb6c4" opacity="0.82"/>
  <path d="M160 640 C260 520 330 570 410 470 C500 360 610 440 735 310 L735 690 L160 690 Z" fill="#516c7e" opacity="0.72"/>
  <circle cx="645" cy="265" r="62" fill="#f6d48f" opacity="0.78"/>
  <text x="132" y="790" font-family="sans-serif" font-size="44" font-weight="800" fill="#263747">${escapeXml(photo.title)}</text>
  <text x="132" y="855" font-family="sans-serif" font-size="29" fill="#425466">${escapeXml(photo.yearLabel)} · ${escapeXml(photo.place)}</text>
  <text x="132" y="930" font-family="sans-serif" font-size="25" fill="#586675">${escapeXml(photo.caption)}</text>
  <text x="132" y="1025" font-family="sans-serif" font-size="21" fill="#7a838d">Dearlog fictional demo image</text>
</svg>`;
}

function normalizePhoto(rawPhoto, index) {
  const [chapterId, title, yearLabel, place, caption] = rawPhoto;
  const photoNumber = String(index + 1).padStart(2, '0');
  const fileName = `${runId}_${profile.key}_photo_${photoNumber}.svg`;
  return {
    id: `${runId}_photo_${profile.key}_${photoNumber}`,
    fileName,
    fileKey: `photos/${fileName}`,
    chapterId,
    title,
    yearLabel,
    place,
    caption,
  };
}

function nextPhotoForChapter(photoState, chapterId) {
  const exact = photoState.find((photo) => !photo.used && photo.chapterId === chapterId);
  const fallback = photoState.find((photo) => !photo.used);
  const photo = exact ?? fallback;
  if (!photo) return null;
  photo.used = true;
  return photo;
}

function questionFor(chapter, scene, photo, index) {
  if (photo) return `${profile.seniorName}님의 ${photo.title} 사진을 보면 어떤 장면이 가장 먼저 떠오르시나요?`;
  if (index % 3 === 0) return `${chapter.title}에서 가족에게 꼭 남기고 싶은 한 장면은 무엇인가요?`;
  return `${scene.time} ${scene.place}에서 있었던 일을 조금 더 들려주세요.`;
}

function transcriptFor(chapter, scene, photo, sequence) {
  const photoLead = photo ? `${photo.yearLabel} ${photo.place}에서 찍은 ${photo.caption}을 보면, ` : '';
  return `${photoLead}${scene.time} ${scene.place}에서 ${scene.people}와 함께했던 일이 또렷합니다. ${scene.object}을 앞에 두고 "${scene.quote}"라는 말을 들었고, 그때 ${scene.action}이 오래 남았습니다. 지금 돌아보면 그 장면은 제 삶에서 ${scene.emotion}을 배운 시간입니다. 민지에게도 일은 서두르기보다 기준을 세우는 것이라는 말을 전하고 싶습니다.`;
}

function summaryFor(chapter, scene, photo) {
  const photoText = photo ? ` ${photo.title} 사진과 연결된 기억입니다.` : '';
  return `${chapter.title}의 ${scene.place} 장면에서 ${scene.object}, ${scene.people}, "${scene.quote}"가 중심 소재입니다.${photoText}`;
}

function publishVersionFor(chapter, scene, photo) {
  const photoLead = photo ? `${photo.title} 사진은 ${scene.place}의 시간을 다시 불러냅니다. ` : '';
  return `${photoLead}${profile.seniorName}은 ${scene.time} ${scene.place}에서 ${scene.people}와 함께한 일을 차분히 떠올립니다. "${scene.quote}"라는 말과 ${scene.action}은 그의 삶에서 기준과 책임을 배운 장면으로 남아 있습니다.`;
}

function memoryTopic(chapter, scene, photo) {
  if (photo) return photo.title;
  return `${chapter.title} - ${scene.object}`;
}

function memoryTags(chapter, scene, photo) {
  return [
    { category: 'demoRun', value: runId },
    { category: 'senior', value: profile.seniorName },
    { category: 'chapter', value: chapter.title },
    { category: 'people', value: scene.people },
    { category: 'places', value: scene.place },
    { category: 'emotions', value: scene.emotion },
    ...(photo ? [{ category: 'photo', value: photo.title }] : []),
  ];
}

function buildNarrative(chapter, records) {
  return {
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    paragraphs: records.slice(0, 5).map((record) => ({
      text: record.publishVersion,
      sourceChunkIds: [record.recordId],
      reliability: 'CONFIRMED',
      uncertaintyNote: '',
    })),
  };
}

async function countTables() {
  const [
    users,
    links,
    records,
    photos,
    questions,
    memories,
    publications,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.guardianSeniorLink.count(),
    prisma.interviewRecord.count(),
    prisma.photo.count(),
    prisma.question.count(),
    prisma.memory.count(),
    prisma.publicationRequest.count(),
  ]);
  return { users, links, records, photos, questions, memories, publications };
}

async function ensureChapters() {
  for (const chapter of chapters) {
    await prisma.chapter.upsert({
      where: { id: chapter.id },
      update: {
        order: chapter.order,
        slug: chapter.slug,
        title: chapter.title,
      },
      create: {
        id: chapter.id,
        order: chapter.order,
        slug: chapter.slug,
        title: chapter.title,
      },
    });
  }
}

async function writeAudioPlaceholder() {
  const audioDir = path.join(rootDir, 'server', 'storage', 'audio');
  await fs.mkdir(audioDir, { recursive: true });
  const fileName = `${runId}_${profile.key}_manual_text_record.txt`;
  await fs.writeFile(
    path.join(audioDir, fileName),
    `Dearlog fictional demo text-only placeholder audio for ${profile.seniorName}\n`,
  );
  return `audio/${fileName}`;
}

async function createPhotos(normalizedPhotos) {
  const photoDir = path.join(rootDir, 'server', 'storage', 'photos');
  await fs.mkdir(photoDir, { recursive: true });
  const created = [];
  for (const photo of normalizedPhotos) {
    await fs.writeFile(path.join(photoDir, photo.fileName), photoSvg(photo));
    const row = await prisma.photo.create({
      data: {
        id: photo.id,
        userId: seniorId,
        fileKey: photo.fileKey,
        fileName: photo.fileName,
        mimeType: 'image/svg+xml',
        metadataJson: JSON.stringify({
          source: 'minji_father_demo_seed',
          title: photo.title,
          yearLabel: photo.yearLabel,
          place: photo.place,
          caption: photo.caption,
        }),
        analysisJson: JSON.stringify({
          description: photo.caption,
          places: [photo.place],
          objects: [photo.title, '항구', '도면'],
          tone: profile.tone,
        }),
        linkedMemoryIds: JSON.stringify([]),
      },
    });
    created.push({ ...photo, row, used: false });
  }
  return created;
}

async function seedFatherSpace() {
  const guardian = await prisma.user.findUnique({ where: { id: guardianId } });
  if (!guardian || guardian.role !== 'guardian') {
    throw new Error(`Guardian not found or not guardian: ${guardianId}`);
  }

  const [existingSenior, existingLink, existingInvitation] = await Promise.all([
    prisma.user.findUnique({ where: { id: seniorId } }),
    prisma.guardianSeniorLink.findUnique({
      where: { guardianId_seniorId: { guardianId, seniorId } },
    }),
    prisma.invitation.findUnique({ where: { seniorId } }),
  ]);

  if (existingSenior || existingLink || existingInvitation) {
    throw new Error(`Minji father demo already exists for seniorId=${seniorId}. No rows were changed.`);
  }

  const before = await countTables();
  const planned = {
    seniorId,
    guardianId,
    recordCount: Object.values(profile.counts).reduce((sum, count) => sum + count, 0),
    photoCount: profile.photos.length,
    pendingQuestionCount: 3,
  };

  console.log(`Minji father demo seed plan: ${JSON.stringify(planned)}`);
  console.log(`Current counts: ${JSON.stringify(before)}`);
  if (dryRun) return { before, after: before, planned, seeded: null };

  await ensureChapters();
  const audioFileKey = await writeAudioPlaceholder();
  const recordsByChapter = new Map(chapters.map((chapter) => [chapter.id, []]));

  await prisma.user.create({
    data: {
      id: seniorId,
      name: profile.seniorName,
      role: 'senior',
      birthDecade: profile.birthDecade,
      preferredName: profile.seniorName,
      seniorName: profile.seniorName,
      seniorBirthDecade: profile.birthDecade,
      seniorPreferredName: profile.seniorName,
      guardianName: profile.guardianName,
      guardianRelationship: profile.relationship,
      guardianPreferredName: profile.guardianName,
      recordSpaceName: profile.recordSpaceName,
      hasCurrentJob: false,
      occupation: profile.occupation,
      hometown: profile.hometown,
      schoolHistory: profile.schoolHistory,
    },
  });

  await prisma.guardianSeniorLink.create({
    data: {
      id: linkId,
      guardianId,
      seniorId,
      relationship: profile.relationship,
    },
  });

  await prisma.invitation.create({
    data: {
      id: invitationId,
      token: invitationToken,
      guardianId,
      seniorId,
      expiresAt: dateDaysAgo(-30, 23),
    },
  });

  const photos = await createPhotos(profile.photos.map(normalizePhoto));

  let recordSequence = 0;
  let questionSequence = 0;

  for (const chapter of chapters) {
    const count = profile.counts[chapter.id] ?? 0;
    const session = await prisma.interviewSession.create({
      data: {
        id: `${runId}_session_${profile.key}_${chapter.id}`,
        seniorId,
        chapterId: chapter.id,
        mode: 'minji_father_demo_seed',
        status: 'completed',
        startedAt: dateDaysAgo(75 - chapter.order, 10),
        endedAt: dateDaysAgo(75 - chapter.order, 11),
      },
    });

    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      recordSequence += 1;
      questionSequence += 1;
      const scene = sceneBank[chapter.id][itemIndex % sceneBank[chapter.id].length];
      const usePhoto = itemIndex === 0 || (itemIndex === 2 && count > 4);
      const photo = usePhoto ? nextPhotoForChapter(photos, chapter.id) : null;
      const questionId = `${runId}_question_${profile.key}_${String(questionSequence).padStart(3, '0')}`;
      const recordId = `${runId}_record_${profile.key}_${String(recordSequence).padStart(3, '0')}`;
      const memoryId = `${runId}_memory_${profile.key}_${String(recordSequence).padStart(3, '0')}`;
      const transcriptText = transcriptFor(chapter, scene, photo, recordSequence);
      const publishVersion = publishVersionFor(chapter, scene, photo);
      const recordedAt = dateDaysAgo(65 - recordSequence, 9 + (recordSequence % 7));

      await prisma.question.create({
        data: {
          id: questionId,
          category: photo ? 'photo_questions' : 'family_questions',
          text: questionFor(chapter, scene, photo, questionSequence),
          chapterId: chapter.id,
          seniorId,
          photoId: photo?.id ?? null,
          createdById: guardianId,
          status: 'answered',
          createdAt: dateDaysAgo(90 - questionSequence, 8),
          answeredAt: recordedAt,
          anonymous: false,
          priority: photo ? 'high' : itemIndex % 4 === 0 ? 'high' : 'normal',
        },
      });

      await prisma.interviewRecord.create({
        data: {
          id: recordId,
          userId: seniorId,
          chapterId: chapter.id,
          questionId,
          sessionId: session.id,
          audioFileKey,
          transcriptText,
          aiSummary: summaryFor(chapter, scene, photo),
          recordedAt,
          source: 'minji_father_demo_seed',
          mode: photo ? 'photo' : 'text',
          publish: true,
          chatbot: true,
          reviewStatus: itemIndex % 6 === 0 ? 'needs_family_review' : 'approved',
          reviewedAt: itemIndex % 6 === 0 ? null : dateDaysAgo(38 - itemIndex, 16),
          reviewRequestText: itemIndex % 6 === 0 ? '가족이 연도와 장소를 한 번 더 확인하면 좋겠습니다.' : null,
        },
      });

      await prisma.memory.create({
        data: {
          id: memoryId,
          userId: seniorId,
          date: recordedAt,
          topic: memoryTopic(chapter, scene, photo),
          originalTranscript: transcriptText,
          cleanedTranscript: transcriptText,
          publishVersion,
          privacy: itemIndex % 7 === 0 ? 'family' : 'public',
          confidenceLabel: itemIndex % 6 === 0 ? '가족 확인 필요' : '확인됨',
          contradictions: JSON.stringify([]),
        },
      });

      await prisma.memoryTag.createMany({
        data: memoryTags(chapter, scene, photo).map((tag, tagIndex) => ({
          id: `${memoryId}_tag_${tagIndex + 1}`,
          memoryId,
          category: tag.category,
          value: tag.value,
        })),
      });

      await prisma.memoryConsentSettings.create({
        data: {
          memoryId,
          publish: itemIndex % 7 === 0 ? 'needs_review' : 'granted',
          familyRead: 'granted',
          chatbot: 'granted',
          posthumous: itemIndex % 7 === 0 ? 'needs_review' : 'granted',
          sensitive: itemIndex % 7 === 0 ? 'needs_review' : 'granted',
        },
      });

      await prisma.memoryVectorEntry.create({
        data: {
          memoryId,
          embeddingJson: JSON.stringify(stableVector(`${profile.key}:${chapter.id}:${recordSequence}`)),
          text: transcriptText,
        },
      });

      await prisma.question.update({
        where: { id: questionId },
        data: {
          answerRecordId: recordId,
          answerMemoryId: memoryId,
        },
      });

      if (photo) {
        const existingMemoryIds = JSON.parse(photo.row.linkedMemoryIds || '[]');
        photo.row.linkedMemoryIds = JSON.stringify([...existingMemoryIds, memoryId]);
        await prisma.photo.update({
          where: { id: photo.id },
          data: { linkedMemoryIds: photo.row.linkedMemoryIds },
        });
      }

      recordsByChapter.get(chapter.id)?.push({ recordId, publishVersion });
    }
  }

  for (const pendingIndex of [1, 2, 3]) {
    const chapter = chapters[(pendingIndex + 1) % chapters.length];
    await prisma.question.create({
      data: {
        id: `${runId}_pending_${profile.key}_${pendingIndex}`,
        category: 'family_questions',
        text: `${profile.guardianName}님이 추가로 남긴 질문: ${profile.seniorName}님께서 ${chapter.title} 중 민지에게 꼭 다시 들려주고 싶은 장면은 무엇인가요?`,
        chapterId: chapter.id,
        seniorId,
        createdById: guardianId,
        status: 'pending',
        priority: pendingIndex === 1 ? 'high' : 'normal',
        anonymous: pendingIndex === 3,
      },
    });
  }

  const cover = await prisma.coverDesign.create({
    data: {
      id: `${runId}_cover_${profile.key}`,
      userId: seniorId,
      palette: 'quiet_blue',
      template: 'chapter_band',
      font: '고딕체',
      analysisJson: JSON.stringify({
        runId,
        source: 'minji_father_demo_seed',
        recommendedTitle: profile.recordSpaceName,
        tone: profile.tone,
        photoCount: photos.length,
      }),
      confirmedAt: dateDaysAgo(8, 13),
    },
  });

  await prisma.publicationRequest.create({
    data: {
      id: `${runId}_publication_${profile.key}`,
      userId: seniorId,
      requestedById: guardianId,
      coverDesignId: cover.id,
      format: 'A5',
      status: 'demo_ready',
      createdAt: dateDaysAgo(7, 14),
    },
  });

  await prisma.legacyVault.create({
    data: {
      id: `${runId}_vault_${profile.key}`,
      seniorId,
      isVaultSetup: false,
      encryptedMemories: JSON.stringify({ runId, demo: true, note: '최민지 아버지 데모용 암호화 스냅샷 자리' }),
      encryptedAutobiography: JSON.stringify({ runId, chapters: chapters.map((chapter) => chapter.id) }),
      serverShare: JSON.stringify({ runId, share: 'B-minji-father-demo' }),
      institutionShare: JSON.stringify({ runId, share: 'C-minji-father-demo' }),
      isDeceased: false,
      deathVerificationStatus: 'alive',
    },
  });

  await prisma.calendarEvent.createMany({
    data: [
      {
        id: `${runId}_calendar_${profile.key}_birthday`,
        userId: seniorId,
        eventType: '생일',
        eventDate: eventDateDaysFromNow(24),
        relatedPersons: JSON.stringify([profile.seniorName, profile.guardianName]),
        recipientId: guardianId,
      },
      {
        id: `${runId}_calendar_${profile.key}_harbor_walk`,
        userId: seniorId,
        eventType: '가족모임',
        eventDate: eventDateDaysFromNow(42),
        relatedPersons: JSON.stringify([profile.guardianName]),
        recipientId: guardianId,
      },
    ],
  });

  const narratives = chapters
    .map((chapter) => buildNarrative(chapter, recordsByChapter.get(chapter.id) ?? []))
    .filter((chapter) => chapter.paragraphs.length > 0);

  await prisma.autobiographyDraft.create({
    data: {
      id: `${runId}_draft_${profile.key}`,
      userId: seniorId,
      structureJson: JSON.stringify({
        runId,
        source: 'minji_father_demo_seed',
        title: profile.recordSpaceName,
        chapters: narratives.map((chapter) => ({ id: chapter.chapterId, title: chapter.chapterTitle })),
      }),
      narrativesJson: JSON.stringify(narratives),
      lastGenerated: dateDaysAgo(4, 17),
    },
  });

  const after = await countTables();
  const report = {
    runId,
    createdAt: new Date().toISOString(),
    databaseUrl: process.env.DATABASE_URL,
    before,
    after,
    delta: Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value - before[key]])),
    seeded: {
      guardianId,
      seniorId,
      recordSpaceName: profile.recordSpaceName,
      recordCount: recordSequence,
      photoCount: photos.length,
      pendingQuestionCount: 3,
      publicationRequestId: `${runId}_publication_${profile.key}`,
    },
  };
  const artifactDir = path.join(rootDir, 'artifacts');
  await fs.mkdir(artifactDir, { recursive: true });
  const reportPath = path.join(artifactDir, `minji-father-demo-seed-${runId}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  return { before, after, planned, seeded: report.seeded, reportPath };
}

seedFatherSpace()
  .then((result) => {
    console.log(`Minji father demo seed complete: ${JSON.stringify(result.seeded)}`);
    if (result.reportPath) console.log(`Report: ${result.reportPath}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
