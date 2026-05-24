import type {
  Autobiography,
  CalendarEvent,
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
  calendarEvents: CalendarEvent[];
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

const coreMemories: Memory[] = [
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

const additionalMemorySpecs: Array<{
  id: string;
  topic: string;
  originalTranscript: string;
  publishVersion: string;
  tags: Memory['tags'];
  linkedPhotoIds?: string[];
}> = [
  {
    id: 'demo_memory_school_rain',
    topic: '비 오는 날의 국민학교',
    originalTranscript: '국민학교 다닐 때 비가 오면 책보가 다 젖었어. 그래도 선생님이 칠판에 써주던 글씨가 좋아서 결석은 잘 안 했지.',
    publishVersion: '1961년 장마철, 김영자는 책보를 품에 안고 부산 골목을 지나 국민학교로 걸어갔습니다. 흙탕물이 신발에 튀고 공책 모서리가 젖어도, 교실에 들어서면 분필 냄새와 나무 책상 냄새가 먼저 반겼습니다. 선생님이 칠판에 또박또박 써주던 글씨를 따라 적으며, 그는 가난한 집 아이에게도 배움이 작은 창문이 될 수 있다는 것을 느꼈습니다.',
    tags: { people: ['담임 선생님', '친구 정숙'], places: ['부산 국민학교'], emotions: ['설렘', '성실함'], timePeriod: '1960년대' },
    linkedPhotoIds: ['demo_photo_school'],
  },
  {
    id: 'demo_memory_radio_father',
    topic: '아버지의 라디오',
    originalTranscript: '아버지는 저녁마다 라디오를 크게 틀어놓으셨어. 뉴스 소리를 들으면 세상이 우리 방 안까지 들어오는 것 같았지.',
    publishVersion: '1967년 무렵, 저녁밥을 먹고 나면 아버지는 낡은 라디오를 방 한가운데 놓았습니다. 지직거리는 소리 사이로 뉴스와 노래가 번갈아 흘렀고, 어린 김영자는 그 소리를 들으며 세상이 생각보다 넓다는 것을 배웠습니다. 가끔 아버지는 말없이 주파수를 맞추다 미소를 지었고, 그 조용한 표정이 오래 기억에 남았습니다.',
    tags: { people: ['아버지'], places: ['부산 집'], emotions: ['호기심', '평온함'], timePeriod: '1960년대' },
    linkedPhotoIds: ['demo_photo_radio'],
  },
  {
    id: 'demo_memory_factory_night',
    topic: '밤샘 재봉틀 소리',
    originalTranscript: '공장에서는 밤에도 재봉틀 소리가 멈추지 않았어. 졸리면 서로 등을 톡톡 쳐주며 버텼지.',
    publishVersion: '1974년 청계천 봉제공장의 밤은 낮보다 더 길었습니다. 형광등 아래 재봉틀 바늘은 쉬지 않고 움직였고, 김영자는 졸음이 몰려올 때마다 동료 숙자와 눈을 마주치며 웃었습니다. 힘든 시간이었지만, 누군가 옆에서 같이 버틴다는 사실만으로도 하루를 넘길 힘이 생겼습니다.',
    tags: { people: ['숙자', '공장 동료'], places: ['청계천 봉제공장'], emotions: ['고단함', '우정'], timePeriod: '1970년대' },
    linkedPhotoIds: ['demo_photo_factory'],
  },
  {
    id: 'demo_memory_boarding_room',
    topic: '하숙집 작은 방',
    originalTranscript: '하숙집 방은 정말 작았어. 그래도 방 한쪽에 부산에서 가져온 사진을 붙여두니 내 자리 같았지.',
    publishVersion: '서울에 올라온 뒤 처음 지낸 하숙집 방은 몸을 돌리기에도 좁았습니다. 김영자는 벽 한쪽에 부산 집에서 가져온 가족사진을 붙이고, 이불을 반듯하게 접어 작은 책상 옆에 두었습니다. 가진 것은 적었지만 자기 손으로 방을 정리하고 나면 낯선 도시에도 아주 작은 자기 자리가 생기는 듯했습니다.',
    tags: { people: ['하숙집 아주머니'], places: ['서울 하숙집'], emotions: ['외로움', '자립심'], timePeriod: '1970년대' },
    linkedPhotoIds: ['demo_photo_boarding'],
  },
  {
    id: 'demo_memory_friend_sookja',
    topic: '숙자와 나눈 국수 한 그릇',
    originalTranscript: '월급날이면 숙자랑 국수를 사 먹었어. 둘이 나눠 먹어도 그 국물이 참 든든했지.',
    publishVersion: '월급을 받은 날이면 김영자와 숙자는 공장 골목 끝 국숫집에 들렀습니다. 둘은 말없이 뜨거운 국물을 먼저 떠먹고, 남은 돈으로 고향집에 무엇을 보낼지 계산했습니다. 국수 한 그릇은 가난한 청춘에게 주어진 작은 축하였고, 서로의 고단함을 알아주는 약속이었습니다.',
    tags: { people: ['숙자'], places: ['청계천 국숫집'], emotions: ['우정', '위로'], timePeriod: '1970년대' },
  },
  {
    id: 'demo_memory_wedding_day',
    topic: '동네 예식장의 결혼식',
    originalTranscript: '결혼식 날은 정신이 하나도 없었어. 엄마가 손수건으로 내 손을 닦아주던 것만 또렷해.',
    publishVersion: '1978년 봄, 동네 예식장은 꽃 장식보다 사람들의 목소리로 더 가득했습니다. 김영자는 낯선 한복 소매를 만지작거리며 긴장했고, 어머니는 손수건으로 딸의 손을 조용히 닦아주었습니다. 결혼식의 자세한 순서는 흐릿하지만, 식장 문 앞에서 어머니가 건넨 그 손길만은 지금도 선명합니다.',
    tags: { people: ['남편', '어머니'], places: ['부산 동네 예식장'], emotions: ['긴장', '감사'], timePeriod: '1970년대' },
    linkedPhotoIds: ['demo_photo_wedding'],
  },
  {
    id: 'demo_memory_first_child',
    topic: '첫아이를 안던 밤',
    originalTranscript: '첫아이를 낳고 밤새 잠을 못 잤어. 작고 따뜻해서, 내가 정말 엄마가 됐구나 싶었지.',
    publishVersion: '1980년 겨울, 첫아이를 품에 안은 밤에 김영자는 거의 잠들지 못했습니다. 아이의 숨소리는 너무 작고 귀해서 자꾸만 귀를 기울이게 했습니다. 불안과 기쁨이 한꺼번에 밀려왔고, 그는 그 밤 처음으로 누군가의 하루를 끝까지 책임진다는 말의 무게를 알았습니다.',
    tags: { people: ['아들'], places: ['산부인과', '서울 집'], emotions: ['기쁨', '두려움'], timePeriod: '1980년대' },
    linkedPhotoIds: ['demo_photo_baby'],
  },
  {
    id: 'demo_memory_lunchbox',
    topic: '딸의 시험 도시락',
    originalTranscript: '딸 시험날에는 새벽부터 도시락을 쌌어. 멸치볶음이 짜지 않을까 몇 번이나 맛봤지.',
    publishVersion: '1989년 딸의 시험날 새벽, 김영자는 부엌 불을 켜고 도시락을 준비했습니다. 멸치볶음의 간을 몇 번이고 보고, 밥 위에는 김가루를 조심스럽게 얹었습니다. 성적보다 더 간절했던 것은 아이가 긴장한 하루를 굶지 않고 지나가는 일이었습니다.',
    tags: { people: ['딸'], places: ['서울 집 부엌'], emotions: ['걱정', '응원'], timePeriod: '1980년대' },
    linkedPhotoIds: ['demo_photo_lunchbox'],
  },
  {
    id: 'demo_memory_first_apartment',
    topic: '처음 얻은 전셋집',
    originalTranscript: '처음 전셋집 열쇠를 받았을 때 문고리를 몇 번이나 만졌어. 우리 집이라는 말이 참 좋았지.',
    publishVersion: '1992년, 가족이 처음으로 방 두 칸짜리 전셋집 열쇠를 받던 날 김영자는 문고리를 오래 만졌습니다. 큰 집은 아니었지만 아이들에게 책상을 하나씩 놓아줄 수 있다는 생각에 마음이 벅찼습니다. 집은 크기보다 그 안에서 마음을 놓을 수 있는 시간이 중요하다는 것을 그때 배웠습니다.',
    tags: { people: ['남편', '아들', '딸'], places: ['서울 전셋집'], emotions: ['안도감', '성취감'], timePeriod: '1990년대' },
    linkedPhotoIds: ['demo_photo_apartment'],
  },
  {
    id: 'demo_memory_father_funeral',
    topic: '아버지 장례식',
    originalTranscript: '아버지 돌아가셨을 때는 내가 너무 늦게 어른이 된 것 같았어. 빈소에서 라디오 생각이 많이 났지.',
    publishVersion: '1995년 아버지의 장례식에서 김영자는 빈소 구석에 앉아 어린 시절 라디오 소리를 떠올렸습니다. 세상이 방 안으로 들어오던 그 저녁들이 한꺼번에 밀려왔고, 아버지에게 더 자주 안부를 묻지 못한 마음이 남았습니다. 이별은 끝이면서도 남은 사람을 다시 살게 하는 숙제였습니다.',
    tags: { people: ['아버지', '형제들'], places: ['부산 장례식장'], emotions: ['상실', '후회'], timePeriod: '1990년대' },
  },
  {
    id: 'demo_memory_side_dish_shop',
    topic: '반찬가게를 돕던 계절',
    originalTranscript: '한동안 동네 반찬가게를 도왔어. 새벽마다 나물 데치고 김치 담그는 냄새가 옷에 배었지.',
    publishVersion: '1997년부터 몇 해 동안 김영자는 동네 반찬가게 일을 도왔습니다. 새벽에는 콩나물을 씻고, 오전에는 김치를 담그고, 오후에는 단골들의 사정을 들었습니다. 손은 늘 마늘 냄새가 배었지만, 누군가의 저녁상에 작은 도움을 보탠다는 생각이 그를 버티게 했습니다.',
    tags: { people: ['반찬가게 사장님', '동네 단골'], places: ['동네 반찬가게'], emotions: ['분주함', '보람'], timePeriod: '1990년대' },
    linkedPhotoIds: ['demo_photo_side_dish'],
  },
  {
    id: 'demo_memory_mother_in_law',
    topic: '시어머니 병간호',
    originalTranscript: '시어머니 아프셨을 때 병원 복도에서 많이 울었어. 그래도 밥숟가락 뜨시는 걸 보면 힘이 났지.',
    publishVersion: '2001년 시어머니의 병간호를 하던 시절, 김영자는 병원 복도 의자에서 밤을 보내는 날이 많았습니다. 힘든 마음이 올라와도 병실 문을 열기 전에는 얼굴을 가다듬었습니다. 한 숟가락이라도 더 드시는 모습을 보면 지친 몸에도 다시 힘이 생겼고, 돌봄이 사랑과 의무 사이 어딘가에 있다는 것을 알게 되었습니다.',
    tags: { people: ['시어머니', '남편'], places: ['서울 병원'], emotions: ['피로', '책임감'], timePeriod: '2000년대' },
  },
  {
    id: 'demo_memory_kimchi_day',
    topic: '온 가족 김장하던 날',
    originalTranscript: '김장날은 힘들어도 좋았어. 배추를 절이고 나면 집안에 겨울 준비가 된 냄새가 났지.',
    publishVersion: '2006년 겨울, 온 가족이 모여 김장을 했습니다. 거실에는 신문지를 깔고, 부엌에서는 고춧가루와 젓갈 냄새가 퍼졌습니다. 김영자는 손주에게 배춧잎 한 장을 건네며 너무 맵지 않게 속을 넣는 법을 알려주었습니다. 김장은 음식이 아니라 겨울을 함께 준비하는 가족의 방식이었습니다.',
    tags: { people: ['딸', '아들', '손녀 민지'], places: ['서울 집'], emotions: ['분주함', '든든함'], timePeriod: '2000년대' },
    linkedPhotoIds: ['demo_photo_kimchi'],
  },
  {
    id: 'demo_memory_husband_illness',
    topic: '남편의 입원',
    originalTranscript: '남편이 입원했을 때 처음으로 내가 혼자 남을 수도 있겠구나 생각했어. 병원 창밖을 오래 봤지.',
    publishVersion: '2009년 남편이 입원했을 때, 김영자는 병원 창밖을 오래 바라보았습니다. 늘 티격태격하던 사람이 침대에 조용히 누워 있으니 집안의 소리까지 달라진 것 같았습니다. 그는 그때부터 말다툼보다 같이 밥 먹는 시간이 더 귀하다는 것을 자주 생각하게 되었습니다.',
    tags: { people: ['남편'], places: ['서울 병원'], emotions: ['불안', '애틋함'], timePeriod: '2000년대' },
  },
  {
    id: 'demo_memory_smartphone_photo',
    topic: '첫 스마트폰 사진',
    originalTranscript: '손녀가 스마트폰으로 사진 찍는 법을 알려줬어. 화면 안에 내가 바로 보이는 게 신기했지.',
    publishVersion: '2012년 손녀 민지는 김영자에게 스마트폰 카메라를 알려주었습니다. 버튼 하나를 누르자 화면 안에 자신의 얼굴이 바로 나타났고, 그는 웃음이 터졌습니다. 처음에는 낯설었지만, 사진을 찍어 멀리 있는 가족에게 바로 보낼 수 있다는 사실이 신기하고 고마웠습니다.',
    tags: { people: ['손녀 민지'], places: ['서울 집 거실'], emotions: ['신기함', '즐거움'], timePeriod: '2010년대' },
    linkedPhotoIds: ['demo_photo_smartphone'],
  },
  {
    id: 'demo_memory_seventieth_birthday',
    topic: '칠순 생일상',
    originalTranscript: '칠순 때 가족들이 몰래 케이크를 준비했어. 나는 괜찮다 했지만 사실은 많이 좋았지.',
    publishVersion: '2020년 칠순 생일날, 가족들은 작은 케이크와 손편지를 준비했습니다. 김영자는 괜찮다고 손사래를 쳤지만, 촛불 앞에 서자 그동안 지나온 시간들이 한꺼번에 떠올랐습니다. 큰 잔치보다 가족이 둘러앉아 이름을 불러주는 순간이 더 깊게 남았습니다.',
    tags: { people: ['아들', '딸', '손녀 민지'], places: ['서울 집'], emotions: ['감동', '쑥스러움'], timePeriod: '2020년대' },
    linkedPhotoIds: ['demo_photo_birthday'],
  },
  {
    id: 'demo_memory_covid_calls',
    topic: '코로나 시기의 영상통화',
    originalTranscript: '코로나 때는 만나지 못하니까 영상통화를 자주 했어. 화면으로라도 손주 얼굴을 보니 마음이 놓였지.',
    publishVersion: '2021년, 가족이 자주 모이지 못하던 시기에 김영자는 영상통화로 안부를 나누었습니다. 작은 화면 속 손주의 얼굴은 가끔 끊기고 목소리는 늦게 도착했지만, 서로의 표정을 확인하는 것만으로도 마음이 놓였습니다. 멀리 있어도 연결될 수 있다는 사실은 늦게 배운 새 위로였습니다.',
    tags: { people: ['손주들', '딸'], places: ['서울 집'], emotions: ['그리움', '안도감'], timePeriod: '2020년대' },
    linkedPhotoIds: ['demo_photo_video_call'],
  },
  {
    id: 'demo_memory_family_letter',
    topic: '가족에게 남기는 편지',
    originalTranscript: '내가 없어도 너무 슬퍼만 하지 말라고 말하고 싶어. 서로 밥 챙겨 먹고 자주 연락하면 된다.',
    publishVersion: '김영자는 가족에게 남기고 싶은 말을 떠올릴 때마다 거창한 유언보다 평범한 당부를 먼저 생각합니다. 서로 밥을 챙겨 먹고, 힘든 날에는 먼저 전화하고, 미안한 말은 오래 미루지 말라는 말입니다. 그에게 가족은 큰 사건보다 매일의 안부로 이어지는 관계입니다.',
    tags: { people: ['아들', '딸', '손주들'], places: ['서울 집'], emotions: ['담담함', '사랑'], timePeriod: '2020년대' },
  },
];

const memories: Memory[] = [
  ...coreMemories,
  ...additionalMemorySpecs.map((memory) => demoMemory(
    memory.id,
    memory.topic,
    memory.originalTranscript,
    memory.publishVersion,
    memory.tags,
    memory.linkedPhotoIds ?? [],
  )),
];

function demoPhotoSvg(label: string, background: string, foreground: string, subLabel = ''): string {
  const subText = subLabel
    ? `<text x="320" y="230" text-anchor="middle" font-size="22" fill="${foreground}">${subLabel}</text>`
    : '';
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="${background}"/><text x="320" y="190" text-anchor="middle" font-size="34" font-family="sans-serif" font-weight="700" fill="${foreground}">${label}</text>${subText}</svg>`)}`;
}

const corePhotos: StoredPhoto[] = [
  {
    id: 'demo_photo_market',
    url: '/demo-photos/bujeon-market.png',
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
    url: '/demo-photos/seoul-station.png',
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
    url: '/demo-photos/family-studio.png',
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
    url: '/demo-photos/songdo-beach.png',
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

const additionalPhotoSpecs: Array<{
  id: string;
  label: string;
  subLabel?: string;
  bg: string;
  fg: string;
  description: string;
  place: string;
  objects: string[];
  fileName: string;
  capturedAt: string;
  cameraMake: string;
  cameraModel: string;
  linkedMemoryIds: string[];
  assetUrl?: string;
}> = [
  {
    id: 'demo_photo_school',
    label: '국민학교',
    subLabel: '비 오는 등굣길',
    bg: '#E0F2FE',
    fg: '#0369A1',
    description: '비 오는 아침, 책보를 품에 안고 국민학교로 가던 골목 사진',
    place: '부산 국민학교',
    objects: ['책보', '나무 책상', '우산'],
    fileName: '1961_국민학교_비오는날.jpg',
    capturedAt: '1961-07-03T00:00:00.000Z',
    cameraMake: 'Yashica',
    cameraModel: 'Electro 35',
    linkedMemoryIds: ['demo_memory_school_rain'],
  },
  {
    id: 'demo_photo_radio',
    label: '라디오',
    subLabel: '아버지의 저녁',
    bg: '#FDE68A',
    fg: '#92400E',
    description: '낡은 라디오와 밥상이 함께 놓인 부산 집 안방 사진',
    place: '부산 집',
    objects: ['라디오', '밥상', '이불장'],
    fileName: '1967_아버지_라디오.jpg',
    capturedAt: '1967-10-22T00:00:00.000Z',
    cameraMake: 'Minolta',
    cameraModel: 'Hi-Matic',
    linkedMemoryIds: ['demo_memory_radio_father'],
  },
  {
    id: 'demo_photo_factory',
    label: '봉제공장',
    subLabel: '밤샘 재봉틀',
    bg: '#EDE9FE',
    fg: '#6D28D9',
    description: '청계천 봉제공장 작업대와 재봉틀이 늘어선 흑백 사진',
    place: '청계천 봉제공장',
    objects: ['재봉틀', '실패', '작업등'],
    fileName: '1974_청계천_봉제공장.jpg',
    capturedAt: '1974-11-14T00:00:00.000Z',
    cameraMake: 'Canon',
    cameraModel: 'FTb',
    linkedMemoryIds: ['demo_memory_factory_night'],
    assetUrl: '/demo-photos/garment-factory.png',
  },
  {
    id: 'demo_photo_boarding',
    label: '하숙집',
    subLabel: '작은 방',
    bg: '#FCE7F3',
    fg: '#BE185D',
    description: '서울 하숙집 방 한쪽에 가족사진을 붙여둔 모습',
    place: '서울 하숙집',
    objects: ['이불', '가족사진', '작은 책상'],
    fileName: '1973_서울_하숙집.jpg',
    capturedAt: '1973-05-09T00:00:00.000Z',
    cameraMake: 'Konica',
    cameraModel: 'C35',
    linkedMemoryIds: ['demo_memory_boarding_room'],
  },
  {
    id: 'demo_photo_wedding',
    label: '결혼식',
    subLabel: '동네 예식장',
    bg: '#FFE4E6',
    fg: '#9F1239',
    description: '동네 예식장 앞에서 어머니와 함께 찍은 결혼식 사진',
    place: '부산 동네 예식장',
    objects: ['한복', '손수건', '꽃 장식'],
    fileName: '1978_결혼식_예식장.jpg',
    capturedAt: '1978-04-16T00:00:00.000Z',
    cameraMake: 'Nikon',
    cameraModel: 'FE',
    linkedMemoryIds: ['demo_memory_wedding_day'],
    assetUrl: '/demo-photos/wedding-hall.png',
  },
  {
    id: 'demo_photo_baby',
    label: '첫아이',
    subLabel: '작은 이불',
    bg: '#DCFCE7',
    fg: '#166534',
    description: '첫아이를 작은 이불에 눕혀 찍은 산후조리 시절 사진',
    place: '서울 집',
    objects: ['아기 이불', '젖병', '손싸개'],
    fileName: '1980_첫아이_아기사진.jpg',
    capturedAt: '1980-12-08T00:00:00.000Z',
    cameraMake: 'Olympus',
    cameraModel: 'Trip 35',
    linkedMemoryIds: ['demo_memory_first_child'],
  },
  {
    id: 'demo_photo_lunchbox',
    label: '도시락',
    subLabel: '시험날 새벽',
    bg: '#FEF9C3',
    fg: '#854D0E',
    description: '딸의 시험날 아침 식탁 위에 놓인 도시락 사진',
    place: '서울 집 부엌',
    objects: ['도시락', '멸치볶음', '김가루'],
    fileName: '1989_딸_시험도시락.jpg',
    capturedAt: '1989-11-02T00:00:00.000Z',
    cameraMake: 'Pentax',
    cameraModel: 'ME Super',
    linkedMemoryIds: ['demo_memory_lunchbox'],
  },
  {
    id: 'demo_photo_apartment',
    label: '전셋집',
    subLabel: '첫 열쇠',
    bg: '#DBEAFE',
    fg: '#1D4ED8',
    description: '방 두 칸 전셋집 문 앞에서 가족이 함께 선 사진',
    place: '서울 전셋집',
    objects: ['열쇠', '책상', '문패'],
    fileName: '1992_첫전셋집_가족.jpg',
    capturedAt: '1992-02-15T00:00:00.000Z',
    cameraMake: 'Nikon',
    cameraModel: 'FM2',
    linkedMemoryIds: ['demo_memory_first_apartment'],
  },
  {
    id: 'demo_photo_side_dish',
    label: '반찬가게',
    subLabel: '새벽 준비',
    bg: '#FFEDD5',
    fg: '#C2410C',
    description: '반찬가게 주방에서 김치와 나물을 준비하던 작업대 사진',
    place: '동네 반찬가게',
    objects: ['김치통', '나물', '고무장갑'],
    fileName: '1997_반찬가게_김치.jpg',
    capturedAt: '1997-09-18T00:00:00.000Z',
    cameraMake: 'Samsung',
    cameraModel: 'Kenox',
    linkedMemoryIds: ['demo_memory_side_dish_shop'],
  },
  {
    id: 'demo_photo_kimchi',
    label: '김장날',
    subLabel: '겨울 준비',
    bg: '#FEE2E2',
    fg: '#B91C1C',
    description: '거실에 신문지를 깔고 온 가족이 김장하던 날의 사진',
    place: '서울 집',
    objects: ['배추', '고춧가루', '김치통'],
    fileName: '2006_가족_김장날.jpg',
    capturedAt: '2006-12-02T00:00:00.000Z',
    cameraMake: 'Canon',
    cameraModel: 'IXUS',
    linkedMemoryIds: ['demo_memory_kimchi_day'],
    assetUrl: '/demo-photos/kimjang-day.png',
  },
  {
    id: 'demo_photo_smartphone',
    label: '스마트폰',
    subLabel: '첫 셀카',
    bg: '#E0E7FF',
    fg: '#4338CA',
    description: '손녀가 알려준 스마트폰 카메라로 처음 찍은 셀카',
    place: '서울 집 거실',
    objects: ['스마트폰', '소파', '가족 액자'],
    fileName: '2012_손녀_스마트폰사진.jpg',
    capturedAt: '2012-06-10T00:00:00.000Z',
    cameraMake: 'Apple',
    cameraModel: 'iPhone 4S',
    linkedMemoryIds: ['demo_memory_smartphone_photo'],
  },
  {
    id: 'demo_photo_birthday',
    label: '칠순',
    subLabel: '가족 케이크',
    bg: '#FAE8FF',
    fg: '#A21CAF',
    description: '칠순 생일상 앞에서 케이크 촛불을 바라보는 가족사진',
    place: '서울 집',
    objects: ['케이크', '손편지', '꽃다발'],
    fileName: '2020_칠순_생일상.jpg',
    capturedAt: '2020-05-19T00:00:00.000Z',
    cameraMake: 'Samsung',
    cameraModel: 'Galaxy S10',
    linkedMemoryIds: ['demo_memory_seventieth_birthday'],
    assetUrl: '/demo-photos/seventieth-birthday.png',
  },
  {
    id: 'demo_photo_video_call',
    label: '영상통화',
    subLabel: '멀리서 안부',
    bg: '#CCFBF1',
    fg: '#0F766E',
    description: '코로나 시기에 손주들과 영상통화를 하던 태블릿 화면 사진',
    place: '서울 집',
    objects: ['태블릿', '손주 얼굴', '찻잔'],
    fileName: '2021_가족_영상통화.jpg',
    capturedAt: '2021-02-13T00:00:00.000Z',
    cameraMake: 'Samsung',
    cameraModel: 'Galaxy Note20',
    linkedMemoryIds: ['demo_memory_covid_calls'],
  },
];

const photos: StoredPhoto[] = [
  ...corePhotos,
  ...additionalPhotoSpecs.map<StoredPhoto>((photo, index) => ({
    id: photo.id,
    url: photo.assetUrl ?? demoPhotoSvg(photo.label, photo.bg, photo.fg, photo.subLabel),
    uploadedAt: now,
    analysis: demoAnalysis(photo.id, photo.description, [photo.place], photo.objects),
    metadata: {
      fileName: photo.fileName,
      fileType: 'image/jpeg',
      fileSize: 420000 + index * 21700,
      lastModified: now,
      capturedAt: photo.capturedAt,
      inferredPlace: photo.place,
      capturedAtSource: 'fileName' as const,
      cameraMake: photo.cameraMake,
      cameraModel: photo.cameraModel,
      gpsLatitude: null,
      gpsLongitude: null,
    },
    linkedMemoryIds: photo.linkedMemoryIds,
  })),
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
  {
    id: 'demo_question_wedding',
    questionText: '결혼식 날 외할머니가 해주신 말씀이 기억나시나요?',
    submittedBy: 'demo_family_daughter',
    anonymous: false,
    priority: 'normal',
    status: 'answered',
    createdAt: now,
    answeredAt: now,
    answerMemoryId: 'demo_memory_wedding_day',
  },
  {
    id: 'demo_question_school',
    questionText: '어릴 때 학교 가는 길에서 가장 선명한 풍경은 무엇이었나요?',
    submittedBy: 'demo_family_granddaughter',
    anonymous: false,
    priority: 'normal',
    status: 'answered',
    createdAt: now,
    answeredAt: now,
    answerMemoryId: 'demo_memory_school_rain',
  },
  {
    id: 'demo_question_covid',
    questionText: '코로나 때 가족을 직접 못 만났을 때 어떤 마음이셨어요?',
    submittedBy: 'demo_family_son',
    anonymous: false,
    priority: 'normal',
    status: 'pending',
    createdAt: now,
    answeredAt: null,
    answerMemoryId: null,
  },
  {
    id: 'demo_question_recipe',
    questionText: '우리 가족 김장 맛을 잊지 않으려면 무엇을 기록해야 할까요?',
    submittedBy: 'demo_family_daughter',
    anonymous: false,
    priority: 'high',
    status: 'answered',
    createdAt: now,
    answeredAt: now,
    answerMemoryId: 'demo_memory_kimchi_day',
  },
  {
    id: 'demo_question_letter',
    questionText: '가족에게 가장 자주 해주고 싶은 당부는 무엇인가요?',
    submittedBy: 'demo_family_granddaughter',
    anonymous: false,
    priority: 'high',
    status: 'answered',
    createdAt: now,
    answeredAt: now,
    answerMemoryId: 'demo_memory_family_letter',
  },
];

const calendarEvents: CalendarEvent[] = [
  {
    id: 'demo_event_granddaughter_birthday',
    title: '손녀 민지 생일',
    eventType: '생일',
    date: '2026-05-20',
    relatedPeople: ['손녀 민지'],
    description: '송도 바다 나들이 기억을 생일 축하 메시지로 다시 꺼내기',
  },
  {
    id: 'demo_event_family_photo_day',
    title: '가족사진 촬영 기념일',
    eventType: '기념일',
    date: '2026-05-27',
    relatedPeople: ['남편', '아들', '딸'],
    description: '1985년 동네 사진관에서 찍은 가족사진을 가족 질문으로 연결',
  },
  {
    id: 'demo_event_kimchi_day',
    title: '가족 김장 모임',
    eventType: '기념일',
    date: '2026-11-28',
    relatedPeople: ['딸', '아들', '손녀 민지'],
    description: '김장 기억을 바탕으로 가족 레시피와 사진을 다시 수집',
  },
  {
    id: 'demo_event_seventieth_birthday',
    title: '칠순 사진 다시 보기',
    eventType: '기념일',
    date: '2026-05-19',
    relatedPeople: ['아들', '딸', '손주들'],
    description: '칠순 생일상 사진과 손편지를 가족 퀴즈로 연결',
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

const chapterTitleOverrides: Record<string, string> = {
  demo_memory_market: '시장 골목에서 배운 마음',
  demo_memory_school_rain: '비 오는 날에도 교실로',
  demo_memory_radio_father: '라디오가 들려준 세상',
  demo_memory_seoul: '서울역에서 시작된 두 번째 삶',
  demo_memory_boarding_room: '하숙집 작은 방',
  demo_memory_factory_night: '밤샘 재봉틀 소리',
  demo_memory_friend_sookja: '숙자와 나눈 국수 한 그릇',
  demo_memory_work: '첫 월급 봉투',
  demo_memory_wedding_day: '동네 예식장의 봄',
  demo_memory_first_child: '첫아이를 안던 밤',
  demo_memory_family: '사진관의 오후',
  demo_memory_lunchbox: '딸의 시험 도시락',
  demo_memory_first_apartment: '처음 얻은 전셋집',
  demo_memory_father_funeral: '아버지의 라디오를 떠올리며',
  demo_memory_side_dish_shop: '반찬가게 새벽',
  demo_memory_lesson: '저녁밥을 지키던 겨울',
  demo_memory_mother_in_law: '병원 복도에서 배운 돌봄',
  demo_memory_granddaughter: '다시 만난 바다의 설렘',
  demo_memory_kimchi_day: '온 가족 김장하던 날',
  demo_memory_husband_illness: '창밖을 오래 바라본 시간',
  demo_memory_smartphone_photo: '첫 스마트폰 사진',
  demo_memory_seventieth_birthday: '칠순 생일상',
  demo_memory_covid_calls: '멀리서도 이어진 안부',
  demo_memory_family_letter: '가족에게 남기는 편지',
};

function buildChapterBody(memory: Memory): string {
  const people = memory.tags.people.length ? memory.tags.people.join(', ') : '가족';
  const places = memory.tags.places.length ? memory.tags.places.join(', ') : '집';
  const emotions = memory.tags.emotions.length ? memory.tags.emotions.join('과 ') : '마음';
  const title = chapterTitleOverrides[memory.id] ?? memory.topic;
  return [
    memory.publishVersion,
    `${title}을 다시 떠올리면 ${places}의 공기와 ${people}의 표정, 그리고 ${emotions}이 함께 살아납니다. Dearlog는 이 장면을 원문 인터뷰와 가족 검수본에 연결해, 가족이 나중에 읽을 때도 실제 말에서 출발한 기록임을 확인할 수 있게 합니다. ${memory.tags.timePeriod}의 이 기억은 과거의 한 장면이면서, 앞으로 가족이 서로의 안부와 마음을 더 자주 묻도록 돕는 작은 안내가 됩니다.`,
  ].join('\n\n');
}

const autobiographyNararatives: ChapterNarrative[] = memories.map((memory, index) => ({
  chapterId: `demo_chapter_${String(index + 1).padStart(2, '0')}_${memory.id.replace('demo_memory_', '')}`,
  title: `${index + 1}장. ${chapterTitleOverrides[memory.id] ?? memory.topic}`,
  body: buildChapterBody(memory),
  citations: [{ sentenceIndex: 0, memoryId: memory.id }],
}));

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
      userId: 'local_senior',
      phoneNumber: '01012345678',
      isAuthenticated: true,
      role: 'senior',
      profile: {
        name: '김영자',
        birthDecade: '1950년대',
        preferredName: '어르신',
      },
      guardianProfile: {
        name: '김민수',
        relationship: '자녀',
        preferredName: '보호자',
      },
      onboardingCompleted: true,
      familyInviteSkipped: true,
      lastSignedInAt: now,
    },
    memories,
    photos,
    familyQuestions,
    calendarEvents,
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
