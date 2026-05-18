export interface DemoScenarioStep {
  step: number;
  title: string;
  routeLabel: string;
  action: string;
  presenterLine: string;
  successSignal: string;
}

export interface PresentationChecklistItem {
  title: string;
  detail: string;
}

export interface DemoScriptSegment {
  timebox: string;
  title: string;
  script: string;
}

export interface JudgeQuestionAnswer {
  question: string;
  answer: string;
}

export const DEMO_SCENARIO_STEPS: DemoScenarioStep[] = [
  {
    step: 1,
    title: '진입과 발표 데이터 준비',
    routeLabel: '설정 / 발표 데모',
    action: '발표용 데이터 불러오기와 네트워크 없이 시연을 켭니다.',
    presenterLine: '오늘 시연은 실제 어르신 인터뷰가 저장돼 있다는 가정으로, 사전 DB를 불러와 안정적으로 진행합니다.',
    successSignal: '기억 카드, 사진, 가족 질문, 자서전 챕터, 검색 연결 수가 모두 채워집니다.',
  },
  {
    step: 2,
    title: '회상 기록 경험',
    routeLabel: '말씀 나누기',
    action: '첫 회상 인터뷰와 사진 기반 회상 흐름을 짧게 보여줍니다.',
    presenterLine: '어르신은 긴 양식을 채우지 않고, 대화하듯 기억을 남깁니다.',
    successSignal: '기억 카드가 생성되고 공개 범위와 동의 항목이 함께 보입니다.',
  },
  {
    step: 3,
    title: '추억 보관함과 가족 검수',
    routeLabel: '추억 보관함 / 가족 공간',
    action: '태그, 사진 메타데이터, 가족 질문, 민감정보 마스킹을 확인합니다.',
    presenterLine: '가족에게 공개되기 전에는 GPS 같은 민감정보를 그대로 보여주지 않고 확인을 거칩니다.',
    successSignal: '사진 위치는 공개 전 확인 필요로 표시되고, 가족 질문이 대기 상태로 남아 있습니다.',
  },
  {
    step: 4,
    title: '나의 분신 대화',
    routeLabel: '나의 분신',
    action: '추천 질문 중 하나를 입력해 저장된 기억 근거가 붙은 답변을 보여줍니다.',
    presenterLine: '챗봇은 없는 이야기를 꾸며내지 않고, 저장된 기억을 근거로 답합니다.',
    successSignal: '답변 아래에 출처 기억 카드와 근거 배지가 표시됩니다.',
  },
  {
    step: 5,
    title: '인쇄용 자서전 결과물',
    routeLabel: '자서전',
    action: '사전 자서전 불러오기 후 인쇄용 PDF를 내려받습니다.',
    presenterLine: '최종 결과물은 앱 안의 기록에 머무르지 않고 가족에게 전달 가능한 인쇄물로 완성됩니다.',
    successSignal: 'A5 인쇄용 PDF가 표지, 목차, 챕터, 사진 페이지를 포함해 생성됩니다.',
  },
];

export const DEMO_PERSONA_QUESTIONS = [
  '처음 서울에 올라왔을 때 이야기를 들려주세요',
  '어머니와 시장에 갔던 날은 어떤 기억인가요?',
  '가족에게 꼭 남기고 싶은 말씀이 있으신가요?',
  '첫 월급을 받았을 때 어떤 마음이었나요?',
];

export const PRINT_READY_CHECKLIST: PresentationChecklistItem[] = [
  {
    title: '표지',
    detail: '제목, 저자명, 캡스톤 발표용 부제가 한눈에 보여야 합니다.',
  },
  {
    title: '목차',
    detail: '5개 이상 챕터가 순서대로 보이고 발표 중 넘겨볼 수 있어야 합니다.',
  },
  {
    title: '본문',
    detail: 'A5 출력 기준으로 한 페이지에 문장이 너무 빽빽하지 않아야 합니다.',
  },
  {
    title: '사진 페이지',
    detail: '대표 사진, 촬영 시기, 장소 추정 정보가 함께 보여야 합니다.',
  },
  {
    title: '개인정보',
    detail: 'GPS 원본 좌표는 인쇄물과 앱 화면에 직접 노출하지 않습니다.',
  },
  {
    title: '가족 검수',
    detail: '가족 확인을 거친 결과물이라는 상태를 발표자가 설명할 수 있어야 합니다.',
  },
];

export const CAPSTONE_SUBMISSION_SECTIONS: PresentationChecklistItem[] = [
  {
    title: '서비스 개요',
    detail: 'Dearlog는 어르신의 기억을 대화, 사진, 가족 질문으로 수집해 자서전과 분신 대화로 확장하는 서비스입니다.',
  },
  {
    title: '사용자 여정',
    detail: '로그인, 회상 기록, 기억 정리, 가족 확인, 분신 대화, 자서전 생성, 사후 정책 설정 순서로 설명합니다.',
  },
  {
    title: '핵심 기술',
    detail: 'React, Zustand persist, RAG 검색 연결, 말투 프로필, PDF 생성, 동의/공개 범위 제어를 중심으로 정리합니다.',
  },
  {
    title: '개인정보 설계',
    detail: '가족 공개 전 동의, 민감정보 마스킹, 사후 이용 정책, 로컬 데모 데이터 분리를 강조합니다.',
  },
  {
    title: '시연 결과물',
    detail: '사전 DB 기반 챗봇 답변과 A5 인쇄용 자서전 PDF를 실제 산출물로 제시합니다.',
  },
];

export const DEMO_PRESENTATION_SCRIPT: DemoScriptSegment[] = [
  {
    timebox: '0:00-0:30',
    title: '문제 제기',
    script: 'Dearlog는 어르신의 기억이 가족에게 남기 어려운 문제에서 출발했습니다. 사진과 이야기는 흩어져 있고, 가족은 무엇을 물어봐야 할지 모르는 경우가 많습니다.',
  },
  {
    timebox: '0:30-1:10',
    title: '서비스 소개',
    script: '이 서비스는 어르신이 대화하듯 기억을 남기면, AI가 기억 카드와 태그를 정리하고 가족 질문과 연결합니다. 최종적으로는 분신 대화와 인쇄용 자서전으로 확장됩니다.',
  },
  {
    timebox: '1:10-2:20',
    title: '핵심 기능 시연',
    script: '먼저 발표용 데이터를 불러오고, 회상 기록과 추억 보관함을 확인하겠습니다. 여기서 중요한 점은 가족에게 공개되기 전에 동의와 민감정보 확인이 함께 따라온다는 것입니다.',
  },
  {
    timebox: '2:20-3:20',
    title: '분신 대화 시연',
    script: '이제 나의 분신에게 질문해 보겠습니다. 답변은 사전에 저장된 기억을 근거로 생성되며, 없는 기억은 억지로 지어내지 않도록 설계했습니다.',
  },
  {
    timebox: '3:20-4:30',
    title: '결과물 제시',
    script: '마지막으로 자서전 화면에서 사전 자서전을 불러오고 인쇄용 PDF를 생성합니다. 발표 결과물은 단순 앱 화면이 아니라 실제 가족에게 건넬 수 있는 A5 자서전입니다.',
  },
  {
    timebox: '4:30-5:00',
    title: '마무리',
    script: 'Dearlog는 기록, 가족 검수, 대화형 회상, 인쇄물 제작을 하나의 여정으로 연결해 기억을 오래 남기는 서비스를 목표로 합니다.',
  },
];

export const JUDGE_QA: JudgeQuestionAnswer[] = [
  {
    question: '실제 개인정보와 사후 데이터는 어떻게 보호하나요?',
    answer: '현재 프로토타입은 로컬 저장 기반이며, 서비스 설계에서는 기억별 공개 범위, 가족 공개 동의, 민감정보 마스킹, 사후 이용 정책을 분리했습니다. GPS 같은 정보는 가족 공개 전 확인 상태로만 보여줍니다.',
  },
  {
    question: '챗봇이 사실과 다른 말을 하면 어떻게 하나요?',
    answer: '분신 대화는 저장된 기억과 검색 연결을 근거로 답하도록 설계했습니다. 발표 데모에서도 근거가 없는 질문에는 기록된 기억이 없다고 답하게 만들어 환각 위험을 줄였습니다.',
  },
  {
    question: '어르신이 사용하기 어렵지 않나요?',
    answer: '핵심 입력은 긴 폼이 아니라 휴대폰 로그인 후 대화형 회상과 사진 기반 회상입니다. 모바일 우선 화면, 큰 CTA, 짧은 단계 흐름을 기준으로 설계했습니다.',
  },
  {
    question: '기존 사진첩이나 메모 앱과 무엇이 다른가요?',
    answer: 'Dearlog는 단순 보관이 아니라 가족 질문, 동의 관리, 근거 기반 분신 대화, 인쇄용 자서전까지 이어지는 전체 여정을 제공합니다.',
  },
  {
    question: '실제 서비스로 확장하려면 무엇이 더 필요한가요?',
    answer: 'SMS 인증, 서버 저장소, 가족 초대 권한, 암호화, 백업, 인쇄 제휴, 의료·심리적 고위험 표현에 대한 안전 정책이 필요합니다. 캡스톤에서는 이 중 핵심 사용자 여정과 결과물을 검증합니다.',
  },
];

export const PITCH_COPY = [
  '어르신의 기억을 대화로 기록하고, 가족에게 자서전으로 전달합니다.',
  '사진, 가족 질문, 회상 인터뷰를 하나의 기억 카드로 정리합니다.',
  '근거 없는 AI 답변이 아니라 저장된 기억에 기반한 분신 대화를 제공합니다.',
  '앱 속 기록을 실제 A5 인쇄 자서전으로 완성합니다.',
  '동의, 공개 범위, 민감정보 마스킹을 기억마다 함께 관리합니다.',
];
