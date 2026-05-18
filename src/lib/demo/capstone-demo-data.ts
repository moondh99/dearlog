import type {
  Autobiography,
  ChapterNarrative,
  DigitalTwinResponse,
  EvidenceBadge,
  FamilyQuestion,
  Memory,
  PhotoAnalysisResult,
  QuestionCategory,
  SpeechProfile,
  StoredPhoto,
  VectorEntry,
} from '../types';
import type { AuthState } from '../../store';

export const DEMO_ID_PREFIX = 'demo_';

export interface CapstoneDemoState {
  auth: AuthState;
  memories: Memory[];
  photos: StoredPhoto[];
  familyQuestions: FamilyQuestion[];
  speechProfile: SpeechProfile;
  autobiographyNararatives: ChapterNarrative[];
  ragEntries: VectorEntry[];
}

export function isDemoId(id: string): boolean {
  return id.startsWith(DEMO_ID_PREFIX);
}

export function isDemoMemoryId(id: string): boolean {
  return isDemoId(id);
}

const now = '2026-05-19T00:00:00.000Z';

function demoMemory(
  id: string,
  topic: string,
  originalTranscript: string,
  publishVersion: string,
  tags: Memory['tags'],
  linkedPhotoIds: string[] = [],
): Memory {
  return {
    id,
    date: now,
    topic,
    originalTranscript,
    cleanedTranscript: publishVersion,
    publishVersion,
    tags,
    privacy: 'family',
    confidenceLabel: '확인됨',
    contradictions: [],
    consent: {
      status: 'granted',
      accessTier: '전체 가족',
      designatedFamilyIds: [],
      lastModified: now,
    },
    consentSettings: {
      출판: 'granted',
      가족열람: 'granted',
      챗봇: 'granted',
      사후공개: 'granted',
      민감정보: 'revoked',
    },
    embedding: null,
    linkedPhotoIds,
    sourceSessionId: `${id}_session`,
  } as Memory;
}

function demoAnalysis(photoId: string, description: string, places: string[], objects: string[]): PhotoAnalysisResult {
  return {
    photoId,
    people: ['김영자'],
    places,
    objects,
    estimatedEra: '1970년대~2000년대',
    description,
  };
}

const memories: Memory[] = [
  demoMemory(
    'demo_memory_market',
    '부전시장 새벽 장보기',
    '초등학교 들어가기 전이었을 거야. 엄마가 새벽에 부전시장 갈 때 나를 깨워서 같이 데려갔지. 겨울이면 손이 참 시렸는데, 엄마 손은 늘 따뜻했어.',
    '1964년 겨울 무렵, 부산 부전시장 새벽 골목은 생선 냄새와 김이 오르는 어묵 국물 냄새로 가득했습니다. 어머니는 장바구니를 한 팔에 걸고 제 손을 꼭 잡았습니다. 손끝은 시렸지만 어머니 손바닥만은 이상하게 따뜻했고, 돌아오는 길에 사주신 눈깔사탕 하나가 하루를 환하게 만들었습니다.',
    { people: ['어머니'], places: ['부산 부전시장'], emotions: ['그리움', '안도감'], timePeriod: '1960년대' },
    ['demo_photo_market'],
  ),
  demoMemory(
    'demo_memory_seoul',
    '서울역에 처음 내린 날',
    '1972년에 부산에서 완행열차 타고 올라왔어. 서울역에 내리니까 사람도 많고, 말도 빠르고, 내가 참 작아진 기분이었지.',
    '1972년 3월, 부산에서 밤새 완행열차를 타고 서울역에 내렸습니다. 손에는 보자기로 싼 옷가지와 어머니가 챙겨준 흰 손수건이 있었습니다. 역 앞 전차 소리와 낯선 사람들의 빠른 말투 속에서 겁이 났지만, 봉제 공장 기숙사 주소가 적힌 종이를 꼭 쥐고 첫발을 떼었습니다.',
    { people: ['어머니'], places: ['서울역', '청계천 봉제공장'], emotions: ['두려움', '용기'], timePeriod: '1970년대' },
    ['demo_photo_seoul'],
  ),
  demoMemory(
    'demo_memory_work',
    '첫 월급 봉투',
    '청계천 근처 봉제공장에서 첫 월급을 받았어. 봉투를 열기도 전에 부산 집에 얼마를 보낼지부터 생각했지.',
    '청계천 근처 봉제공장에서 첫 월급 봉투를 받던 날, 저는 오래도록 봉투를 열지 못했습니다. 큰돈은 아니었지만 그 안에는 제 이름으로 번 첫 생활이 들어 있었습니다. 하숙집 방에서 돈을 세어 부산 집으로 보낼 몫을 따로 접어두던 순간, 저는 조금 어른이 된 것 같았습니다.',
    { people: ['아버지', '어머니', '공장 동료'], places: ['청계천 봉제공장', '하숙집'], emotions: ['자부심', '책임감'], timePeriod: '1970년대' },
  ),
  demoMemory(
    'demo_memory_family',
    '사진관에서 찍은 가족사진',
    '1985년에 아이들 손 잡고 동네 사진관에 갔어. 아들은 자꾸 넥타이를 만지고, 딸은 앞머리가 마음에 안 든다고 했지.',
    '1985년 가을, 남편과 아이 둘을 데리고 동네 사진관에 갔습니다. 아들은 빌린 넥타이를 자꾸 만졌고, 딸은 앞머리가 마음에 들지 않는다며 입술을 삐죽였습니다. 사진사는 조금만 웃어보라고 했지만 모두가 어색했습니다. 그래도 그 사진은 우리가 단칸방과 전세집을 지나 여기까지 함께 왔다는 증거처럼 남았습니다.',
    { people: ['남편', '아들', '딸'], places: ['동네 사진관'], emotions: ['행복', '애틋함'], timePeriod: '1980년대' },
    ['demo_photo_family'],
  ),
  demoMemory(
    'demo_memory_lesson',
    'IMF 겨울에 배운 것',
    'IMF 때는 다들 마음이 쪼그라들었어. 그래도 저녁밥은 같이 먹자고 했지. 밥상 앞에서는 애들한테 겁난 티를 덜 내고 싶었어.',
    '1998년 겨울, 집안 공기는 늘 조심스러웠습니다. 남편의 일도 흔들렸고 아이들도 부모 눈치를 보았습니다. 그때 제가 지키려고 한 것은 거창한 말이 아니라 저녁밥이었습니다. 찌개 하나라도 끓여 식구가 같은 상에 앉으면, 하루가 아주 무너지지는 않는다고 믿었습니다.',
    { people: ['남편', '아들', '딸'], places: ['서울 집'], emotions: ['불안', '버팀'], timePeriod: '1990년대' },
  ),
  demoMemory(
    'demo_memory_granddaughter',
    '손녀와 송도 바다',
    '손녀 민지가 바다를 보고 싶다고 해서 부산 송도에 데려갔어. 모래 묻은 신발을 털어주는데, 내가 엄마한테 받았던 마음이 생각나더라.',
    '2004년 여름, 손녀 민지를 데리고 부산 송도 바다에 갔습니다. 아이는 파도가 발끝까지 오면 깔깔 웃었고, 저는 젖은 양말과 모래 묻은 신발을 털어주었습니다. 문득 오래전 부전시장에서 어머니가 제 손을 잡아주던 감각이 떠올랐습니다. 돌봄은 그렇게 이름을 바꾸어 다음 세대로 건너간다는 생각이 들었습니다.',
    { people: ['손녀 민지'], places: ['부산 송도 바다'], emotions: ['기쁨', '애정'], timePeriod: '2000년대' },
    ['demo_photo_granddaughter'],
  ),
];

const photos: StoredPhoto[] = [
  {
    id: 'demo_photo_market',
    url: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22400%22%3E%3Crect width=%22640%22 height=%22400%22 fill=%22%23FEF3C7%22/%3E%3Ctext x=%22320%22 y=%22200%22 text-anchor=%22middle%22 font-size=%2232%22 fill=%22%23B45309%22%3E%EB%B6%80%EC%82%B0 %EC%8B%9C%EC%9E%A5%3C/text%3E%3C/svg%3E',
    uploadedAt: now,
    analysis: demoAnalysis('demo_photo_market', '부산 부전시장 골목에서 어머니와 장을 보고 돌아오는 흑백 사진', ['부산 부전시장'], ['장바구니', '어묵 가게', '간판']),
    metadata: {
      fileName: '1964_부전시장_엄마와장보기.jpg',
      fileType: 'image/jpeg',
      fileSize: 482300,
      lastModified: now,
      capturedAt: '1964-12-18T00:00:00.000Z',
      inferredPlace: '부산 부전시장',
      capturedAtSource: 'fileName',
      cameraMake: 'Minolta',
      cameraModel: 'SR-T 101',
      gpsLatitude: 35.17955,
      gpsLongitude: 129.07564,
    },
    linkedMemoryIds: ['demo_memory_market'],
  },
  {
    id: 'demo_photo_seoul',
    url: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22400%22%3E%3Crect width=%22640%22 height=%22400%22 fill=%22%23CCFBF1%22/%3E%3Ctext x=%22320%22 y=%22200%22 text-anchor=%22middle%22 font-size=%2232%22 fill=%22%230F766E%22%3E%EC%84%9C%EC%9A%B8%EC%97%AD%3C/text%3E%3C/svg%3E',
    uploadedAt: now,
    analysis: demoAnalysis('demo_photo_seoul', '서울역 광장 앞에서 보자기와 작은 가방을 들고 서 있는 사진', ['서울역'], ['보자기', '가방', '기차역']),
    metadata: {
      fileName: '1972_서울역_상경첫날.jpg',
      fileType: 'image/jpeg',
      fileSize: 523100,
      lastModified: now,
      capturedAt: '1972-03-12T00:00:00.000Z',
      inferredPlace: '서울역',
      capturedAtSource: 'fileName',
      cameraMake: 'Canon',
      cameraModel: 'Canon FTb',
      gpsLatitude: 37.55468,
      gpsLongitude: 126.97061,
    },
    linkedMemoryIds: ['demo_memory_seoul'],
  },
  {
    id: 'demo_photo_family',
    url: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22400%22%3E%3Crect width=%22640%22 height=%22400%22 fill=%22%23FAF7F2%22/%3E%3Ctext x=%22320%22 y=%22200%22 text-anchor=%22middle%22 font-size=%2232%22 fill=%22%231C1917%22%3E%EA%B0%80%EC%A1%B1 %EC%82%AC%EC%A7%84%3C/text%3E%3C/svg%3E',
    uploadedAt: now,
    analysis: demoAnalysis('demo_photo_family', '남편과 두 아이가 동네 사진관에서 나란히 앉아 찍은 가족사진', ['동네 사진관'], ['넥타이', '원피스', '액자']),
    metadata: {
      fileName: '1985_가족사진.jpg',
      fileType: 'image/jpeg',
      fileSize: 611200,
      lastModified: now,
      capturedAt: '1985-09-21T00:00:00.000Z',
      inferredPlace: '동네 사진관',
      capturedAtSource: 'fileName',
      cameraMake: 'Nikon',
      cameraModel: 'FM2',
      gpsLatitude: null,
      gpsLongitude: null,
    },
    linkedMemoryIds: ['demo_memory_family'],
  },
  {
    id: 'demo_photo_granddaughter',
    url: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22400%22%3E%3Crect width=%22640%22 height=%22400%22 fill=%22%23DBEAFE%22/%3E%3Ctext x=%22320%22 y=%22182%22 text-anchor=%22middle%22 font-size=%2232%22 fill=%22%231D4ED8%22%3E%EC%86%A1%EB%8F%84 %EB%B0%94%EB%8B%A4%3C/text%3E%3Ctext x=%22320%22 y=%22225%22 text-anchor=%22middle%22 font-size=%2222%22 fill=%22%231E3A8A%22%3E%EC%86%90%EB%85%80%EC%99%80 %ED%95%A8%EA%BB%98%3C/text%3E%3C/svg%3E',
    uploadedAt: now,
    analysis: demoAnalysis('demo_photo_granddaughter', '손녀 민지와 부산 송도 바닷가에서 찍은 여름 나들이 사진', ['부산 송도 바다'], ['파도', '모래사장', '운동화']),
    metadata: {
      fileName: '2004_송도바다_손녀.jpg',
      fileType: 'image/jpeg',
      fileSize: 702400,
      lastModified: now,
      capturedAt: '2004-08-14T00:00:00.000Z',
      inferredPlace: '부산 송도 바다',
      capturedAtSource: 'fileName',
      cameraMake: 'Olympus',
      cameraModel: 'mju',
      gpsLatitude: 35.07522,
      gpsLongitude: 129.01786,
    },
    linkedMemoryIds: ['demo_memory_granddaughter'],
  },
];

const familyQuestions: FamilyQuestion[] = [
  {
    id: 'demo_question_seoul',
    questionText: '처음 서울에 올라오셨을 때 가장 무서웠던 순간은 언제였나요?',
    submittedBy: 'demo_family_daughter',
    anonymous: false,
    priority: 'high',
    status: 'pending',
    createdAt: now,
    answeredAt: null,
    answerMemoryId: null,
  },
  {
    id: 'demo_question_lesson',
    questionText: '손주들에게 꼭 남기고 싶은 말씀이 있으신가요?',
    submittedBy: 'demo_family_son',
    anonymous: false,
    priority: 'normal',
    status: 'answered',
    createdAt: now,
    answeredAt: now,
    answerMemoryId: 'demo_memory_lesson',
  },
  {
    id: 'demo_question_granddaughter',
    questionText: '손녀와 함께한 나들이 중 가장 오래 기억나는 순간은 언제인가요?',
    submittedBy: 'demo_family_granddaughter',
    anonymous: false,
    priority: 'normal',
    status: 'answered',
    createdAt: now,
    answeredAt: now,
    answerMemoryId: 'demo_memory_granddaughter',
  },
];

const speechProfile: SpeechProfile = {
  sentenceEndings: ['~했지', '~란다', '~구나'],
  vocabularyPreferences: {
    어머니: '엄마',
    가족: '우리 식구',
  },
  fillerWords: ['그러니까', '그때는 말이야'],
  characteristicExpressions: ['밥 한 끼가 제일 중요하지', '사람은 서로 기대고 살아야 한단다'],
  dialect: null,
  sessionCount: 4,
  lastUpdated: now,
};

const autobiographyNararatives: ChapterNarrative[] = [
  {
    chapterId: 'demo_chapter_childhood',
    title: '1장. 시장 골목에서 배운 마음',
    body: '제 어린 시절을 떠올리면 가장 먼저 부산 부전시장 새벽 골목이 생각납니다. 1964년 겨울쯤이었을 겁니다. 어머니는 장바구니를 한 팔에 걸고 다른 손으로 제 손을 잡았습니다. 시장 바닥에는 물기가 남아 있었고, 생선 냄새와 어묵 국물 냄새가 뒤섞여 있었습니다. 손끝은 시렸지만 어머니 손바닥만은 늘 따뜻했습니다. 돌아오는 길에 받아 든 눈깔사탕 하나가 얼마나 귀했는지, 저는 그 단맛을 오래 아껴 먹었습니다. 지금 생각하면 그 사탕보다 더 오래 남은 것은 어머니가 손을 놓지 않던 감각입니다.',
    citations: [{ sentenceIndex: 0, memoryId: 'demo_memory_market' }],
  },
  {
    chapterId: 'demo_chapter_seoul',
    title: '2장. 서울역에서 시작된 두 번째 삶',
    body: '1972년 3월, 부산에서 밤새 완행열차를 타고 서울역에 내렸습니다. 보자기로 싼 옷가지와 작은 가방 하나가 전부였습니다. 역 앞은 제 생각보다 훨씬 넓었고 사람들의 말은 빠르게 흘러갔습니다. 저는 주머니 속에 접어 넣은 기숙사 주소와 어머니가 챙겨준 흰 손수건을 번갈아 만졌습니다. 겁이 났지만 돌아갈 수는 없었습니다. 그날 서울역 앞에서 떼어 놓은 첫걸음이 제 삶의 두 번째 장을 열었습니다. 두려움은 사라지지 않았지만, 두려움과 함께 걸어가는 법을 그때 처음 배웠습니다.',
    citations: [{ sentenceIndex: 0, memoryId: 'demo_memory_seoul' }],
  },
  {
    chapterId: 'demo_chapter_work',
    title: '3장. 첫 월급 봉투',
    body: '청계천 근처 봉제공장에서 첫 월급 봉투를 받던 날을 기억합니다. 하루 종일 재봉틀 소리가 귀에 남아 있었고, 손끝에는 실밥이 붙어 있었습니다. 하숙집 방에 돌아와서야 봉투를 열었습니다. 많지 않은 돈이었지만 제 이름으로 번 첫 생활비였습니다. 저는 먼저 부산 집으로 보낼 돈을 접어 따로 두었습니다. 그 작은 지폐 몇 장이 저를 갑자기 어른으로 만든 것 같았습니다. 책임이라는 말은 거창한 약속이 아니라, 누군가의 밥값과 약값을 먼저 떠올리는 마음이라는 것을 그날 알았습니다.',
    citations: [{ sentenceIndex: 0, memoryId: 'demo_memory_work' }],
  },
  {
    chapterId: 'demo_chapter_family',
    title: '4장. 사진관의 오후',
    body: '1985년 가을, 남편과 아이 둘을 데리고 동네 사진관에 갔습니다. 아들은 빌린 넥타이를 자꾸 만졌고, 딸은 앞머리가 마음에 들지 않는다며 입술을 삐죽였습니다. 사진사는 조금만 웃어보라고 했지만 우리 모두 웃는 법을 잊은 사람처럼 어색했습니다. 그래도 셔터가 눌리던 순간만큼은 이상하게 조용했습니다. 그 사진은 단칸방과 전세집, 이사와 걱정 사이를 지나온 우리 식구의 증명사진이 되었습니다. 지나고 보니 특별한 날보다 그런 평범한 오후가 더 오래 마음에 남습니다.',
    citations: [{ sentenceIndex: 0, memoryId: 'demo_memory_family' }],
  },
  {
    chapterId: 'demo_chapter_message',
    title: '5장. 저녁밥을 지키던 겨울',
    body: '1998년 겨울은 우리 집에도 조용히 찾아왔습니다. 남편의 일이 흔들렸고 아이들은 부모 눈치를 보았습니다. 저는 겁이 나지 않은 척했지만 밤에는 오래 잠들지 못했습니다. 그때 제가 지키려고 한 것은 대단한 원칙이 아니라 저녁밥이었습니다. 찌개 하나라도 끓여 식구들이 같은 상에 앉으면, 하루가 아주 무너지지는 않는다고 믿었습니다. 가족에게 남기고 싶은 말도 그때와 다르지 않습니다. 큰 성공보다 서로의 밥과 안부를 챙기는 마음이 우리를 더 오래 지켜줍니다.',
    citations: [{ sentenceIndex: 0, memoryId: 'demo_memory_lesson' }],
  },
  {
    chapterId: 'demo_chapter_granddaughter',
    title: '6장. 다시 만난 바다의 설렘',
    body: '2004년 여름, 손녀 민지를 데리고 부산 송도 바다에 갔습니다. 아이는 파도가 발끝까지 오면 깔깔 웃었고, 저는 젖은 양말과 모래 묻은 운동화를 털어주었습니다. 문득 오래전 부전시장에서 어머니가 제 손을 잡아주던 기억이 떠올랐습니다. 그때 저는 돌봄을 받는 아이였고, 이제는 아이의 신발을 털어주는 할머니가 되어 있었습니다. 세월은 사람을 멀리 데려가는 것 같지만, 어떤 마음은 이름만 바꾸어 다음 세대로 건너갑니다. 그날 바다에서 저는 그 사실을 조용히 배웠습니다.',
    citations: [{ sentenceIndex: 0, memoryId: 'demo_memory_granddaughter' }],
  },
];

function embedding(seed: number): number[] {
  return Array.from({ length: 16 }, (_, index) => ((seed + index * 7) % 19) / 19);
}

const ragEntries: VectorEntry[] = memories.map((memory, index) => ({
  memoryId: memory.id,
  embedding: embedding(index + 1),
  text: [
    memory.cleanedTranscript,
    `인물: ${memory.tags.people.join(', ')}`,
    `장소: ${memory.tags.places.join(', ')}`,
    `감정: ${memory.tags.emotions.join(', ')}`,
    `시기: ${memory.tags.timePeriod}`,
  ].join('\n'),
}));

export function buildDemoAutobiography(): Autobiography {
  return {
    title: '김영자의 이야기',
    chapters: autobiographyNararatives,
    generatedAt: now,
  };
}

export function buildCapstoneDemoState(): CapstoneDemoState {
  return {
    auth: {
      phoneNumber: '01012345678',
      isAuthenticated: true,
      role: 'senior',
      profile: {
        name: '김영자',
        birthDecade: '1950년대',
        preferredName: '어르신',
      },
      onboardingCompleted: true,
      familyInviteSkipped: true,
      lastSignedInAt: now,
    },
    memories,
    photos,
    familyQuestions,
    speechProfile,
    autobiographyNararatives,
    ragEntries,
  };
}

function classifyDemoQuestion(question: string): QuestionCategory {
  if (/엄마|어머니|가족|아이|아들|딸|손주/.test(question)) return '인물관련형';
  if (/언제|시절|처음|그때|젊/.test(question)) return '시기회상형';
  if (/의미|왜|교훈|남기고|소중|중요/.test(question)) return '가치관탐색형';
  return '사실확인형';
}

function scoreMemory(memory: Memory, question: string): number {
  const normalized = question.toLowerCase();
  const haystack = [
    memory.topic,
    memory.publishVersion,
    ...memory.tags.people,
    ...memory.tags.places,
    ...memory.tags.emotions,
    memory.tags.timePeriod,
  ].join(' ').toLowerCase();

  return normalized
    .split(/\s+/)
    .filter((word) => word.length > 1 && haystack.includes(word)).length;
}

export function createDemoPersonaResponse(question: string, sourceMemories: Memory[] = memories): DigitalTwinResponse {
  const questionCategory = classifyDemoQuestion(question);
  const relevantMemories = sourceMemories
    .filter((memory) => isDemoMemoryId(memory.id))
    .map((memory) => ({ memory, score: scoreMemory(memory, question) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.memory);

  if (relevantMemories.length === 0) {
    return {
      text: '그 이야기는 아직 기록된 기억이 없어서 내가 함부로 지어 말하긴 어렵구나. 먼저 그 기억을 함께 남겨보면 좋겠다.',
      evidenceBadges: [],
      linkedMemoryCards: [],
      questionCategory,
    };
  }

  const primary = relevantMemories[0];
  const evidenceBadges: EvidenceBadge[] = relevantMemories.map((memory, index) => ({
    memoryId: memory.id,
    relevanceScore: index === 0 ? 0.94 : 0.78,
    excerpt: memory.publishVersion.slice(0, 64),
  }));

  return {
    text: `${primary.tags.timePeriod}의 ${primary.topic} 이야기가 떠오르는구나. ${primary.publishVersion} 그래서 나는 가족에게 작은 안부와 따뜻한 밥 한 끼가 오래 남는다고 말해주고 싶단다. [출처: ${primary.id}]`,
    evidenceBadges,
    linkedMemoryCards: relevantMemories.map((memory) => memory.id),
    questionCategory,
  };
}
