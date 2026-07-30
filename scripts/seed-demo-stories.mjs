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

const chapters = [
  { id: 'childhood', order: 1, slug: 'childhood', title: '유년기' },
  { id: 'adolescence', order: 2, slug: 'adolescence', title: '청소년기' },
  { id: 'youth', order: 3, slug: 'youth', title: '청년기' },
  { id: 'family_home', order: 4, slug: 'family-home', title: '가정을 꾸린 이야기' },
  { id: 'hobbies', order: 5, slug: 'hobbies', title: '취미' },
  { id: 'relationships', order: 6, slug: 'relationships', title: '인간관계' },
  { id: 'messages', order: 7, slug: 'messages', title: '전하고 싶은 이야기' },
];

const chapterTitleById = new Map(chapters.map((chapter) => [chapter.id, chapter.title]));

const chapterSpokenLabelById = new Map([
  ['childhood', '어릴 때를 떠올리면'],
  ['adolescence', '학교 다닐 때 이야기를 하자면'],
  ['youth', '젊었을 때를 생각하면'],
  ['family_home', '가정을 꾸리고 나서의 시간을 떠올리면'],
  ['hobbies', '내가 좋아하던 일을 말하자면'],
  ['relationships', '사람들과 지내던 일을 떠올리면'],
  ['messages', '가족에게 남기고 싶은 말을 생각하면'],
]);

const sceneBank = {
  childhood: [
    { time: '초등학교 들어가기 전 겨울', place: '아궁이 옆 부엌', people: '어머니와 동생들', object: '보리밥 냄비', emotion: '따뜻함', quote: '불씨만 살려두면 밥은 된다', action: '새벽마다 물을 길어 놓던 일' },
    { time: '장마가 끝난 여름', place: '마을 개울가', people: '동네 친구들', object: '고무신', emotion: '해방감', quote: '해 지기 전에만 들어오너라', action: '물살에 고무신을 띄워 보내던 놀이' },
    { time: '국민학교 2학년 무렵', place: '흙먼지 나는 운동장', people: '담임 선생님', object: '몽당연필', emotion: '설렘', quote: '글씨는 사람 마음을 닮는다', action: '받아쓰기 공책을 품에 안고 돌아오던 길' },
  ],
  adolescence: [
    { time: '중학교 입학식 날', place: '비탈길 위 교문', people: '단짝 친구', object: '천 가방', emotion: '두근거림', quote: '우리도 이제 큰 사람이 되는 거야', action: '새 교복 소매를 몇 번이고 만지던 일' },
    { time: '열여섯 살 가을', place: '학교 뒤 은행나무 길', people: '국어 선생님', object: '시집 한 권', emotion: '자부심', quote: '네 말에는 장면이 있다', action: '처음으로 글을 칭찬받은 순간' },
    { time: '졸업을 앞둔 겨울', place: '교실 난로 앞', people: '같은 반 친구들', object: '연탄집게', emotion: '아쉬움', quote: '다음 봄에도 편지하자', action: '서로 주소를 공책 끝에 적어 주던 일' },
  ],
  youth: [
    { time: '스무 살 첫 출근 날', place: '새벽 버스 정류장', people: '직장 선배', object: '도시락 보자기', emotion: '긴장', quote: '모르면 묻고, 알면 도와라', action: '버스 창에 비친 얼굴을 다잡던 순간' },
    { time: '첫 월급을 받은 저녁', place: '시장 골목', people: '부모님', object: '흰 고무신 한 켤레', emotion: '뿌듯함', quote: '이제 네 손으로 집에 빛을 보태는구나', action: '월급봉투를 그대로 어머니 손에 올려놓던 일' },
    { time: '서른을 앞둔 어느 봄', place: '기숙사 옥상', people: '오랜 동료', object: '라디오', emotion: '희망', quote: '우리도 언젠가 가게 문패를 달자', action: '밤바람 속에서 미래를 크게 말해 보던 시간' },
  ],
  family_home: [
    { time: '신혼 첫해 추석', place: '작은 전셋집 부엌', people: '배우자와 시어머니', object: '놋그릇', emotion: '낯섦과 애틋함', quote: '서툴러도 마음이 먼저면 된다', action: '송편을 망쳐 놓고도 함께 웃던 일' },
    { time: '첫아이를 안은 새벽', place: '산부인과 창가', people: '배우자', object: '분홍 포대기', emotion: '경이로움', quote: '이 아이에게는 덜 고생시키자', action: '아기의 발가락을 세어 보던 순간' },
    { time: '가족이 모두 모인 일요일', place: '안방 밥상', people: '자녀들', object: '김치찌개 냄비', emotion: '평온', quote: '밥 먹는 시간이 집의 중심이다', action: '밥그릇을 한 번씩 더 밀어 주던 풍경' },
  ],
  hobbies: [
    { time: '일을 마친 저녁', place: '동네 문화센터', people: '동호회 친구들', object: '낡은 악보', emotion: '즐거움', quote: '늦게 배워도 목소리는 늦지 않는다', action: '처음 합창 무대에 선 일' },
    { time: '쉰다섯 살 생일 무렵', place: '집 베란다', people: '손주', object: '화분 세 개', emotion: '차분함', quote: '식물도 말 걸어 주면 힘이 난다', action: '매일 아침 잎 끝을 살펴보던 습관' },
    { time: '겨울 장날 오후', place: '단골 찻집', people: '오래된 이웃', object: '대추차', emotion: '위로', quote: '오늘 하루도 무사했다', action: '장부를 덮고 따뜻한 잔을 쥐던 시간' },
  ],
  relationships: [
    { time: '이사 온 첫해', place: '골목 끝 대문 앞', people: '옆집 아주머니', object: '김 한 봉지', emotion: '고마움', quote: '멀리 온 사람끼리 더 챙겨야지', action: '낯선 동네에서 처음 마음을 놓은 일' },
    { time: '가게가 힘들던 해', place: '시장 번영회 사무실', people: '동료 상인들', object: '공동 장부', emotion: '연대감', quote: '혼자 버티지 말고 같이 버티자', action: '서로 손님을 소개해 주던 일' },
    { time: '오래 연락이 끊긴 뒤', place: '버스터미널 대합실', people: '옛 친구', object: '구겨진 편지', emotion: '미안함', quote: '늦었어도 와 줘서 됐다', action: '말없이 손을 잡고 한참 앉아 있던 순간' },
  ],
  messages: [
    { time: '최근 가족 식사 자리', place: '거실 창가', people: '자녀와 손주들', object: '가족사진 액자', emotion: '감사', quote: '사는 일은 결국 서로 밥을 챙기는 일이다', action: '아이들 이름을 하나씩 불러 주던 일' },
    { time: '건강검진을 다녀온 날', place: '동네 공원 벤치', people: '배우자', object: '작은 수첩', emotion: '담담함', quote: '남은 날은 급하게 쓰지 말자', action: '하고 싶은 말을 적어 보기 시작한 일' },
    { time: '혼자 오래 생각한 밤', place: '침대 머리맡', people: '먼저 떠난 가족', object: '낡은 시계', emotion: '그리움', quote: '미안하다는 말보다 고맙다는 말을 더 남기고 싶다', action: '가족에게 남길 문장을 고른 시간' },
  ],
};

const profiles = [
  {
    key: 'kim_yeongja',
    seniorName: '김영자',
    guardianName: '최민지',
    relationship: '딸',
    birthDecade: '1940년대',
    hometown: '전남 구례',
    occupation: '남대문시장 반찬가게 운영',
    schoolHistory: '구례국민학교 졸업 후 가족 농사를 도왔음',
    recordSpaceName: '영자 어머니의 장터와 밥상',
    tone: '담백하고 따뜻한 구어체',
    counts: { childhood: 6, adolescence: 5, youth: 6, family_home: 6, hobbies: 3, relationships: 4, messages: 4 },
    photos: [
      ['childhood', '마당의 감나무', '1952년 무렵', '구례 본가', '감나무 아래에서 동생들과 찍은 흑백사진'],
      ['adolescence', '졸업식 리본', '1959년 봄', '구례국민학교', '졸업식 날 가슴에 단 작은 리본'],
      ['youth', '시장 첫 가게', '1968년', '남대문시장', '처음 얻은 좌판 앞에서 웃는 모습'],
      ['family_home', '첫아이 백일상', '1974년', '서울 신당동', '가족이 둘러앉은 백일상'],
      ['family_home', '김장하던 날', '1986년 겨울', '마당', '큰 대야에 배추를 쌓아 두고 김장하던 풍경'],
      ['relationships', '상인회 단체사진', '1993년', '시장 골목', '함께 버틴 동료 상인들과의 사진'],
      ['messages', '손주와 밥상', '2022년', '집 거실', '손주에게 밥을 떠 주는 장면'],
    ],
  },
  {
    key: 'park_sunrye',
    seniorName: '박순례',
    guardianName: '박도윤',
    relationship: '손자',
    birthDecade: '1950년대',
    hometown: '강원 강릉',
    occupation: '초등학교 급식 조리사',
    schoolHistory: '강릉여자중학교 졸업',
    recordSpaceName: '순례 할머니의 바다와 급식실',
    tone: '밝고 생활감 있는 회상체',
    counts: { childhood: 5, adolescence: 6, youth: 6, family_home: 7, hobbies: 5, relationships: 5, messages: 4 },
    photos: [
      ['childhood', '바닷가 소풍', '1958년', '경포대', '모래사장에 앉아 도시락을 나누던 날'],
      ['adolescence', '합창대회', '1967년', '강릉여중 강당', '교복을 입고 합창대회에 선 사진'],
      ['youth', '첫 급식실', '1975년', '초등학교 조리실', '커다란 솥 앞에서 앞치마를 두른 모습'],
      ['family_home', '아이들 운동회', '1984년', '학교 운동장', '도시락 보자기를 든 운동회 날'],
      ['family_home', '가족 기차여행', '1991년', '정동진역', '아이들과 새벽 기차를 탔던 사진'],
      ['hobbies', '노래교실 발표회', '2006년', '문화센터', '작은 무대에서 노래하던 순간'],
      ['relationships', '급식실 동료들', '2012년', '학교 식당', '퇴임 전 동료들과 찍은 사진'],
      ['messages', '손자 졸업식', '2021년', '대학교 정문', '손자의 졸업식에서 꽃다발을 든 사진'],
    ],
  },
  {
    key: 'lee_jeonghun',
    seniorName: '이정훈',
    guardianName: '이서연',
    relationship: '딸',
    birthDecade: '1940년대',
    hometown: '부산 영도',
    occupation: '조선소 설계 기사',
    schoolHistory: '부산공업고등학교 졸업',
    recordSpaceName: '정훈 아버지의 항구와 도면',
    tone: '차분하고 정확한 설명체',
    counts: { childhood: 5, adolescence: 5, youth: 7, family_home: 5, hobbies: 3, relationships: 3, messages: 3 },
    photos: [
      ['childhood', '영도 골목', '1951년', '부산 영도', '항구가 내려다보이는 골목 사진'],
      ['adolescence', '공업고 실습실', '1963년', '부산공고', '제도판 앞에서 친구들과 선 모습'],
      ['youth', '조선소 도면', '1972년', '울산 조선소', '첫 배 설계 도면을 들고 찍은 사진'],
      ['youth', '작업복의 봄', '1978년', '조선소 정문', '작업복 차림으로 퇴근하던 날'],
      ['family_home', '새집 입주', '1985년', '부산 사하구', '가족이 처음 마련한 집 앞 사진'],
      ['messages', '항구 산책', '2023년', '부산항', '딸과 함께 항구를 걷던 사진'],
    ],
  },
  {
    key: 'choi_malsun',
    seniorName: '최말순',
    guardianName: '정하늘',
    relationship: '며느리',
    birthDecade: '1930년대',
    hometown: '충남 공주',
    occupation: '포목점 운영',
    schoolHistory: '공주읍 보통학교 수료',
    recordSpaceName: '말순 어머님의 천과 혼례',
    tone: '조심스럽고 정갈한 회고체',
    counts: { childhood: 4, adolescence: 3, youth: 4, family_home: 5, hobbies: 2, relationships: 2, messages: 2 },
    photos: [
      ['childhood', '공주 장터길', '1944년', '공주 산성시장', '어머니 손을 잡고 장에 가던 길'],
      ['youth', '포목점 간판', '1961년', '공주 읍내', '작은 포목점 앞 간판 사진'],
      ['family_home', '혼례복 손질', '1970년', '포목점 안', '고운 비단을 접어 두던 장면'],
      ['relationships', '단골 손님들과', '1988년', '가게 앞', '오래 다닌 단골 손님들과 찍은 사진'],
    ],
  },
  {
    key: 'han_myeongsuk',
    seniorName: '한명숙',
    guardianName: '한지우',
    relationship: '아들',
    birthDecade: '1950년대',
    hometown: '서울 성북',
    occupation: '동네 의원 간호조무사',
    schoolHistory: '성북여자상업고등학교 졸업',
    recordSpaceName: '명숙 어머니의 병원 노트',
    tone: '또렷하고 배려 깊은 문장',
    counts: { childhood: 3, adolescence: 4, youth: 5, family_home: 5, hobbies: 2, relationships: 2, messages: 2 },
    photos: [
      ['adolescence', '상고 교실', '1969년', '성북여상', '타자기 앞에 앉은 고등학교 시절 사진'],
      ['youth', '의원 접수대', '1977년', '성북동 의원', '첫 직장 접수대에서 찍은 사진'],
      ['family_home', '밤샘 간호 뒤 아침', '1983년', '집 부엌', '아이 도시락을 싸던 아침'],
      ['messages', '가족 건강수첩', '2024년', '거실', '가족 건강 기록을 정리해 둔 수첩'],
    ],
  },
  {
    key: 'oh_gitae',
    seniorName: '오기태',
    guardianName: '오은재',
    relationship: '손녀',
    birthDecade: '1940년대',
    hometown: '제주 서귀포',
    occupation: '감귤 농장 운영',
    schoolHistory: '서귀포농업고등학교 졸업',
    recordSpaceName: '기태 할아버지의 귤밭과 바람',
    tone: '소박하고 유머 있는 회상체',
    counts: { childhood: 4, adolescence: 4, youth: 5, family_home: 4, hobbies: 4, relationships: 3, messages: 2 },
    photos: [
      ['childhood', '돌담길', '1953년', '서귀포 마을', '바람 많은 돌담길에서 찍은 어린 시절 사진'],
      ['youth', '첫 감귤 수확', '1969년', '귤밭', '나무 상자에 감귤을 담던 첫 수확 날'],
      ['family_home', '가족 귤 선별', '1982년', '농장 창고', '가족이 함께 귤을 고르던 겨울'],
      ['hobbies', '바다 낚시', '2001년', '서귀포 방파제', '일을 마치고 낚싯대를 들었던 오후'],
      ['relationships', '작목반 모임', '2010년', '마을회관', '감귤 작목반 사람들과 찍은 사진'],
    ],
  },
];

function getArgValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : fallback;
}

function sanitizeRunId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
}

function todayStamp() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(now).replace(', ', '_').replace(/[-:]/g, '');
}

const runId = sanitizeRunId(getArgValue('--run-id', `demo_bulk_${todayStamp()}`));
const resetRunId = process.argv.includes('--reset-run-id');
const dryRun = process.argv.includes('--dry-run');

function hashNumber(input) {
  return Number.parseInt(crypto.createHash('sha256').update(input).digest('hex').slice(0, 8), 16);
}

function phoneFor(offset) {
  const base = (hashNumber(`${runId}:${offset}`) % 90000000) + 10000000;
  return `010${String(base).padStart(8, '0')}`;
}

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

function svgForPhoto(profile, photo, index) {
  const palettes = [
    ['#f3ead8', '#895f42', '#3d3328'],
    ['#dfe8e4', '#51776d', '#213934'],
    ['#eee2e7', '#8a5966', '#3b2930'],
    ['#e3e7f0', '#526b8b', '#273141'],
  ];
  const palette = palettes[(hashNumber(`${profile.key}:${photo.title}`) + index) % palettes.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="820" viewBox="0 0 1200 820">
  <rect width="1200" height="820" fill="${palette[0]}"/>
  <rect x="72" y="68" width="1056" height="684" rx="34" fill="#fffaf2" opacity="0.78"/>
  <rect x="110" y="112" width="980" height="452" rx="24" fill="${palette[1]}" opacity="0.92"/>
  <circle cx="245" cy="220" r="72" fill="#fff5db" opacity="0.62"/>
  <path d="M130 528 C280 432 390 472 515 405 C660 327 790 362 1064 220 L1064 564 L130 564 Z" fill="#ffffff" opacity="0.28"/>
  <text x="130" y="636" font-family="serif" font-size="54" fill="${palette[2]}">${escapeXml(photo.title)}</text>
  <text x="132" y="690" font-family="sans-serif" font-size="27" fill="${palette[2]}" opacity="0.82">${escapeXml(profile.seniorName)} · ${escapeXml(photo.yearLabel)} · ${escapeXml(photo.place)}</text>
  <text x="132" y="730" font-family="sans-serif" font-size="22" fill="${palette[2]}" opacity="0.68">Dearlog archive</text>
</svg>
`;
}

function stableVector(seed) {
  const bytes = crypto.createHash('sha256').update(seed).digest();
  return Array.from({ length: 24 }, (_, index) => {
    const value = bytes[index] / 255;
    return Number((value * 2 - 1).toFixed(4));
  });
}

function normalizePhoto(profile, raw, index) {
  const [chapterId, title, yearLabel, place, caption] = raw;
  const fileName = `${runId}_${profile.key}_photo_${String(index + 1).padStart(2, '0')}.svg`;
  return {
    id: `${runId}_photo_${profile.key}_${String(index + 1).padStart(2, '0')}`,
    chapterId,
    title,
    yearLabel,
    place,
    caption,
    fileName,
    fileKey: `photos/${fileName}`,
  };
}

function nextPhotoForChapter(photoState, chapterId) {
  const exact = photoState.find((photo) => !photo.used && photo.chapterId === chapterId);
  if (exact) {
    exact.used = true;
    return exact;
  }
  return null;
}

function questionFor(profile, chapterId, scene, photo, ordinal) {
  if (photo) {
    return `${photo.title} 사진을 보면 ${photo.place}에서의 어떤 장면이 가장 먼저 떠오르시나요?`;
  }
  const title = chapterTitleById.get(chapterId) ?? chapterId;
  return `${profile.seniorName}님의 ${title} 중 ${scene.object}와 관련해 가장 선명한 기억은 무엇인가요?`;
}

function hasFinalConsonant(value) {
  const char = String(value).trim().at(-1);
  if (!char) return false;
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function subject(value) {
  return `${value}${hasFinalConsonant(value) ? '이' : '가'}`;
}

function topic(value) {
  return `${value}${hasFinalConsonant(value) ? '은' : '는'}`;
}

function pastCopula(value, ending) {
  return `${value}${hasFinalConsonant(value) ? '이었' : '였'}${ending}`;
}

function titlePhrase(chapterId) {
  const title = chapterTitleById.get(chapterId) ?? chapterId;
  return title.endsWith('이야기') ? title : `${title} 이야기`;
}

function transcriptFor(profile, chapterId, scene, photo) {
  const spokenLabel = chapterSpokenLabelById.get(chapterId) ?? titlePhrase(chapterId);
  const opening = photo
    ? `"${photo.title}" 사진을 보면 ${photo.place} 생각이 제일 먼저 나. ${photo.caption} 모습인데, 사진을 보고 있으면 그때 공기하고 사람들 표정까지 같이 떠오르는 것 같아.`
    : `${spokenLabel}, 나는 아직도 ${subject(scene.place)} 먼저 떠올라.`;
  return [
    opening,
    `${pastCopula(scene.time, '는데')}, ${scene.people}하고 같이 있었고 ${subject(scene.object)} 유난히 눈에 들어왔어.`,
    `그때 "${scene.quote}"라는 말을 들었거나 마음속으로 오래 붙잡고 있었는데, 이상하게 그 말이 아직도 남아 있어.`,
    `${topic(scene.action)} 대단한 일은 아니어도 그 순간의 ${scene.emotion}은 몸이 먼저 기억하는 것 같아.`,
    `${profile.hometown}에서 살던 시절부터 그런 마음이 조금씩 쌓였고, 나중에 ${profile.occupation} 일을 할 때도 사람을 대하고 가족을 챙기는 데 영향을 줬던 것 같아.`,
  ].join(' ');
}

function summaryFor(profile, chapterId, scene, photo) {
  const photoLead = photo ? `${photo.title} 사진을 중심으로 ` : '';
  return `${photoLead}${profile.seniorName}님의 ${titlePhrase(chapterId)}에서 ${scene.place}, ${scene.people}, "${scene.quote}"가 주요 장면으로 남아 있습니다.`;
}

function publishVersionFor(profile, chapterId, scene, photo) {
  const photoLead = photo ? `${photo.title} 사진에서 시작된 기억입니다. ` : '';
  return `${photoLead}${scene.time} ${scene.place}에서 ${scene.people}하고 함께한 장면은 ${profile.seniorName}님에게 오래 남은 ${titlePhrase(chapterId)}입니다. "${scene.quote}"라는 말과 ${scene.action}이 이 이야기의 중심입니다.`;
}

function memoryTopic(chapterId, scene, photo) {
  const title = chapterTitleById.get(chapterId) ?? chapterId;
  return photo ? `${title} - ${photo.title}` : `${title} - ${scene.object}`;
}

function memoryTags(profile, chapterId, scene, photo) {
  return [
    { category: 'people', value: scene.people },
    { category: 'places', value: photo?.place ?? scene.place },
    { category: 'emotions', value: scene.emotion },
    { category: 'timePeriod', value: scene.time },
    { category: 'demoRun', value: runId },
    { category: 'chapter', value: chapterId },
    { category: 'senior', value: profile.seniorName },
  ];
}

function buildNarrative(profile, chapterId, records) {
  const paragraphs = records.slice(0, 4).map((record, index) => ({
    paragraphId: `${runId}_${profile.key}_${chapterId}_p${index + 1}`,
    text: record.transcriptText.split(' ').slice(0, 58).join(' ') + '.',
    sourceChunkIds: [record.memoryId],
    reliability: 'CONFIRMED',
    uncertaintyNote: '',
  }));
  const expected = profile.counts[chapterId] ?? 0;
  return {
    chapterId,
    chapterTitle: chapterTitleById.get(chapterId) ?? chapterId,
    paragraphs,
    missingSections: expected < 3 ? ['가족이 확인할 구체적 연도와 인물 이름이 더 필요합니다'] : [],
    toneProfile: {
      name: profile.tone,
      patterns: ['구체적인 장소를 먼저 말함', '가족에게 설명하듯 차분히 이어감', '직접 인용을 한 문장 남김'],
    },
  };
}

function countPlannedRecords() {
  return profiles.reduce((total, profile) => {
    return total + Object.values(profile.counts).reduce((sum, count) => sum + count, 0);
  }, 0);
}

async function countTables() {
  const [
    users,
    links,
    questions,
    photos,
    sessions,
    records,
    memories,
    memoryTagsCount,
    covers,
    publicationRequests,
    calendarEvents,
    invitations,
    vaults,
    drafts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.guardianSeniorLink.count(),
    prisma.question.count(),
    prisma.photo.count(),
    prisma.interviewSession.count(),
    prisma.interviewRecord.count(),
    prisma.memory.count(),
    prisma.memoryTag.count(),
    prisma.coverDesign.count(),
    prisma.publicationRequest.count(),
    prisma.calendarEvent.count(),
    prisma.invitation.count(),
    prisma.legacyVault.count(),
    prisma.autobiographyDraft.count(),
  ]);
  return {
    users,
    links,
    questions,
    photos,
    sessions,
    records,
    memories,
    memoryTags: memoryTagsCount,
    covers,
    publicationRequests,
    calendarEvents,
    invitations,
    vaults,
    drafts,
  };
}

async function cleanupRun() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: `${runId}_` } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  await prisma.invitation.deleteMany({
    where: {
      OR: [
        { token: { startsWith: `${runId}_` } },
        ...(userIds.length ? [{ guardianId: { in: userIds } }, { seniorId: { in: userIds } }] : []),
      ],
    },
  });
  await prisma.question.deleteMany({ where: { id: { startsWith: `${runId}_` } } });
  if (userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  for (const dir of ['photos', 'audio']) {
    const storageDir = path.join(rootDir, 'server', 'storage', dir);
    try {
      const fileNames = await fs.readdir(storageDir);
      await Promise.all(
        fileNames
          .filter((fileName) => fileName.startsWith(`${runId}_`))
          .map((fileName) => fs.unlink(path.join(storageDir, fileName))),
      );
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

async function ensureChapters() {
  for (const chapter of chapters) {
    await prisma.chapter.upsert({
      where: { id: chapter.id },
      update: {
        order: chapter.order,
        slug: chapter.slug,
        title: chapter.title,
        minAnswerCount: 15,
      },
      create: {
        ...chapter,
        minAnswerCount: 15,
      },
    });
  }
}

async function writeDemoAudioPlaceholder() {
  const audioDir = path.join(rootDir, 'server', 'storage', 'audio');
  await fs.mkdir(audioDir, { recursive: true });
  const fileName = `${runId}_manual_text_record.txt`;
  await fs.writeFile(
    path.join(audioDir, fileName),
    `Dearlog demo text-only placeholder audio for run ${runId}\n`,
  );
  return `audio/${fileName}`;
}

async function createDemoPhotoFilesAndRows(profile, seniorId, normalizedPhotos) {
  const photoDir = path.join(rootDir, 'server', 'storage', 'photos');
  await fs.mkdir(photoDir, { recursive: true });
  const created = [];
  for (const [index, photo] of normalizedPhotos.entries()) {
    await fs.writeFile(path.join(photoDir, photo.fileName), svgForPhoto(profile, photo, index));
    const row = await prisma.photo.create({
      data: {
        id: photo.id,
        userId: seniorId,
        fileKey: photo.fileKey,
        fileName: photo.fileName,
        mimeType: 'image/svg+xml',
        metadataJson: JSON.stringify({
          runId,
          source: 'demo_story_seed',
          chapterId: photo.chapterId,
          title: photo.title,
          yearLabel: photo.yearLabel,
          place: photo.place,
          caption: photo.caption,
        }),
        analysisJson: JSON.stringify({
          tags: [photo.chapterId, photo.place, profile.seniorName],
          recommendedQuestion: `${photo.title} 사진 속 하루를 조금 더 들려주세요.`,
          visualMood: 'archival_demo',
        }),
        uploadedAt: dateDaysAgo(95 - index, 9),
      },
    });
    created.push({ ...photo, row });
  }
  return created;
}

async function seedProfile(profile, index, audioFileKey) {
  const seniorId = `${runId}_senior_${profile.key}`;
  const guardianId = `${runId}_guardian_${profile.key}`;
  const invitationToken = `${runId}_${profile.key}_invite`;

  await prisma.user.create({
    data: {
      id: seniorId,
      name: profile.seniorName,
      phoneNumber: phoneFor(index * 2 + 1),
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

  await prisma.user.create({
    data: {
      id: guardianId,
      name: profile.guardianName,
      phoneNumber: phoneFor(index * 2 + 2),
      role: 'guardian',
      preferredName: profile.guardianName,
      seniorName: profile.seniorName,
      seniorBirthDecade: profile.birthDecade,
      seniorPreferredName: profile.seniorName,
      guardianName: profile.guardianName,
      guardianRelationship: profile.relationship,
      guardianPreferredName: profile.guardianName,
      recordSpaceName: profile.recordSpaceName,
    },
  });

  await prisma.guardianSeniorLink.create({
    data: {
      id: `${runId}_link_${profile.key}`,
      guardianId,
      seniorId,
      relationship: profile.relationship,
    },
  });

  await prisma.invitation.create({
    data: {
      id: `${runId}_invitation_${profile.key}`,
      token: invitationToken,
      guardianId,
      seniorId,
      expiresAt: dateDaysAgo(-30, 23),
    },
  });

  const photos = await createDemoPhotoFilesAndRows(
    profile,
    seniorId,
    profile.photos.map((photo, photoIndex) => normalizePhoto(profile, photo, photoIndex)),
  );
  const photoState = photos.map((photo) => ({ ...photo, used: false }));
  const recordsByChapter = new Map(chapters.map((chapter) => [chapter.id, []]));
  let recordSequence = 0;
  let questionSequence = 0;

  for (const chapter of chapters) {
    const count = profile.counts[chapter.id] ?? 0;
    if (!count) continue;
    const session = await prisma.interviewSession.create({
      data: {
        id: `${runId}_session_${profile.key}_${chapter.id}`,
        seniorId,
        chapterId: chapter.id,
        mode: 'demo_story_seed',
        status: 'completed',
        startedAt: dateDaysAgo(80 - index * 5 - chapter.order, 10),
        endedAt: dateDaysAgo(80 - index * 5 - chapter.order, 11),
      },
    });

    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      recordSequence += 1;
      questionSequence += 1;
      const sceneList = sceneBank[chapter.id];
      const scene = sceneList[(itemIndex + index) % sceneList.length];
      const usePhoto = itemIndex === 0 || (itemIndex === 2 && (profile.counts[chapter.id] ?? 0) > 3);
      const photo = usePhoto ? nextPhotoForChapter(photoState, chapter.id) : null;
      const questionId = `${runId}_question_${profile.key}_${String(questionSequence).padStart(3, '0')}`;
      const recordId = `${runId}_record_${profile.key}_${String(recordSequence).padStart(3, '0')}`;
      const memoryId = `${runId}_memory_${profile.key}_${String(recordSequence).padStart(3, '0')}`;
      const transcriptText = transcriptFor(profile, chapter.id, scene, photo, recordSequence);
      const recordedAt = dateDaysAgo(70 - index * 6 - recordSequence, 9 + (recordSequence % 7));

      await prisma.question.create({
        data: {
          id: questionId,
          category: photo ? 'photo_questions' : 'family_questions',
          text: questionFor(profile, chapter.id, scene, photo, questionSequence),
          chapterId: chapter.id,
          seniorId,
          photoId: photo?.id ?? null,
          createdById: guardianId,
          status: 'answered',
          createdAt: dateDaysAgo(90 - index * 4 - questionSequence, 8),
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
          aiSummary: summaryFor(profile, chapter.id, scene, photo),
          recordedAt,
          source: 'demo_story_seed',
          mode: photo ? 'photo' : 'text',
          publish: true,
          chatbot: true,
          reviewStatus: itemIndex % 5 === 0 ? 'needs_family_review' : 'approved',
          reviewedAt: itemIndex % 5 === 0 ? null : dateDaysAgo(45 - index * 5 - itemIndex, 16),
          reviewRequestText: itemIndex % 5 === 0 ? '가족이 연도나 함께 있던 사람 이름을 한 번 더 확인하면 좋겠습니다.' : null,
        },
      });

      await prisma.memory.create({
        data: {
          id: memoryId,
          userId: seniorId,
          date: recordedAt,
          topic: memoryTopic(chapter.id, scene, photo),
          originalTranscript: transcriptText,
          cleanedTranscript: transcriptText,
          publishVersion: publishVersionFor(profile, chapter.id, scene, photo),
          privacy: itemIndex % 7 === 0 ? 'family' : 'public',
          confidenceLabel: itemIndex % 5 === 0 ? '가족 확인 필요' : '확인됨',
          contradictions: JSON.stringify([]),
        },
      });

      await prisma.memoryTag.createMany({
        data: memoryTags(profile, chapter.id, scene, photo).map((tag, tagIndex) => ({
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
        await prisma.photo.update({
          where: { id: photo.id },
          data: { linkedMemoryIds: JSON.stringify([...existingMemoryIds, memoryId]) },
        });
      }

      recordsByChapter.get(chapter.id)?.push({ recordId, memoryId, transcriptText });
    }
  }

  for (const pendingIndex of [1, 2, 3]) {
    const chapter = chapters[(index + pendingIndex) % chapters.length];
    await prisma.question.create({
      data: {
        id: `${runId}_pending_${profile.key}_${pendingIndex}`,
        category: 'family_questions',
        text: `${profile.guardianName}님이 추가로 남긴 질문: ${profile.seniorName}님께서 ${chapter.title} 중 가족에게 꼭 다시 들려주고 싶은 장면은 무엇인가요?`,
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
      palette: index % 2 === 0 ? 'warm_archive' : 'quiet_blue',
      template: index % 3 === 0 ? 'photo_plate' : 'chapter_band',
      font: index % 2 === 0 ? '명조체' : '고딕체',
      analysisJson: JSON.stringify({
        runId,
        source: 'demo_story_seed',
        recommendedTitle: profile.recordSpaceName,
        tone: profile.tone,
        photoCount: photos.length,
      }),
      confirmedAt: dateDaysAgo(12 - index, 13),
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
      createdAt: dateDaysAgo(10 - index, 14),
    },
  });

  await prisma.legacyVault.create({
    data: {
      id: `${runId}_vault_${profile.key}`,
      seniorId,
      isVaultSetup: false,
      encryptedMemories: JSON.stringify({ runId, demo: true, note: '데모용 암호화 스냅샷 자리' }),
      encryptedAutobiography: JSON.stringify({ runId, chapters: chapters.map((chapter) => chapter.id) }),
      serverShare: JSON.stringify({ runId, share: 'B-demo' }),
      institutionShare: JSON.stringify({ runId, share: 'C-demo' }),
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
        eventDate: eventDateDaysFromNow(20 + index),
        relatedPersons: JSON.stringify([profile.seniorName, profile.guardianName]),
        recipientId: guardianId,
      },
      {
        id: `${runId}_calendar_${profile.key}_family_visit`,
        userId: seniorId,
        eventType: '가족모임',
        eventDate: eventDateDaysFromNow(35 + index * 2),
        relatedPersons: JSON.stringify([profile.guardianName]),
        recipientId: guardianId,
      },
    ],
  });

  const narratives = chapters
    .map((chapter) => buildNarrative(profile, chapter.id, recordsByChapter.get(chapter.id) ?? []))
    .filter((chapter) => chapter.paragraphs.length > 0);

  await prisma.autobiographyDraft.create({
    data: {
      id: `${runId}_draft_${profile.key}`,
      userId: seniorId,
      structureJson: JSON.stringify({
        runId,
        source: 'demo_story_seed',
        title: profile.recordSpaceName,
        chapters: narratives.map((chapter) => ({ id: chapter.chapterId, title: chapter.chapterTitle })),
      }),
      narrativesJson: JSON.stringify(narratives),
      lastGenerated: dateDaysAgo(5 - index, 17),
    },
  });

  return {
    seniorId,
    guardianId,
    invitationToken,
    recordCount: recordSequence,
    photoCount: photos.length,
    pendingQuestionCount: 3,
    publicationRequestId: `${runId}_publication_${profile.key}`,
  };
}

async function main() {
  const planned = {
    runId,
    profiles: profiles.length,
    records: countPlannedRecords(),
    photos: profiles.reduce((sum, profile) => sum + profile.photos.length, 0),
    pendingQuestions: profiles.length * 3,
  };
  console.log(`Dearlog demo seed plan: ${JSON.stringify(planned)}`);

  if (!runId) {
    throw new Error('runId is empty after sanitization');
  }

  const before = await countTables();
  const existingUsers = await prisma.user.count({ where: { id: { startsWith: `${runId}_` } } });
  if (dryRun) {
    console.log(`Dry run only. Existing users for runId=${runId}: ${existingUsers}`);
    console.log(`Current counts: ${JSON.stringify(before)}`);
    return;
  }

  if (existingUsers > 0) {
    if (!resetRunId) {
      throw new Error(`runId ${runId} already exists. Re-run with --reset-run-id to replace only this demo run.`);
    }
    console.log(`Resetting existing demo rows for runId=${runId}`);
    await cleanupRun();
  }

  await ensureChapters();
  const audioFileKey = await writeDemoAudioPlaceholder();
  const seededProfiles = [];
  for (const [index, profile] of profiles.entries()) {
    seededProfiles.push(await seedProfile(profile, index, audioFileKey));
    console.log(`Seeded ${profile.seniorName}: ${seededProfiles.at(-1).recordCount} records, ${seededProfiles.at(-1).photoCount} photos`);
  }

  const after = await countTables();
  const delta = Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value - before[key]]));
  const artifactDir = path.join(rootDir, 'artifacts');
  await fs.mkdir(artifactDir, { recursive: true });
  const reportPath = path.join(artifactDir, `demo-seed-${runId}.json`);
  const report = {
    runId,
    createdAt: new Date().toISOString(),
    databaseUrl: process.env.DATABASE_URL,
    before,
    after,
    delta,
    planned,
    profiles: seededProfiles,
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Demo seed complete for runId=${runId}`);
  console.log(`Delta: ${JSON.stringify(delta)}`);
  console.log(`Report: ${reportPath}`);
  console.log('Demo user headers example:');
  console.log(`  senior:   x-user-id=${seededProfiles[0].seniorId}, x-user-role=senior`);
  console.log(`  guardian: x-user-id=${seededProfiles[0].guardianId}, x-user-role=guardian`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
