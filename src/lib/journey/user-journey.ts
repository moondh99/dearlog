export type JourneyStageId = 'record' | 'archive' | 'review' | 'persona' | 'autobiography';
export type JourneyStageStatus = 'done' | 'active' | 'ready' | 'locked';

export interface JourneyStage {
  id: JourneyStageId;
  label: string;
  route: string;
  status: JourneyStageStatus;
}

export interface JourneyInput {
  pathname: string;
  memoryCount: number;
  publicMemoryCount: number;
  pendingFamilyQuestionCount: number;
  speechProfileReady: boolean;
  autobiographyChapterCount: number;
}

export interface JourneyAction {
  route: string;
  label: string;
}

export interface UserJourneyState {
  stages: JourneyStage[];
  currentStageId: JourneyStageId;
  nextAction: JourneyAction;
}

const STAGE_DEFINITIONS: Array<Omit<JourneyStage, 'status'>> = [
  { id: 'record', label: '회상 기록', route: '/' },
  { id: 'archive', label: '기억 정리', route: '/archive' },
  { id: 'review', label: '가족 확인', route: '/review' },
  { id: 'persona', label: '분신 대화', route: '/persona' },
  { id: 'autobiography', label: '자서전', route: '/autobiography' },
];

export function getCurrentJourneyStageId(pathname: string): JourneyStageId {
  if (pathname.startsWith('/archive')) return 'archive';
  if (pathname.startsWith('/review')) return 'review';
  if (pathname.startsWith('/persona')) return 'persona';
  if (pathname.startsWith('/autobiography')) return 'autobiography';
  return 'record';
}

function isStageDone(stageId: JourneyStageId, input: JourneyInput): boolean {
  switch (stageId) {
    case 'record':
      return input.memoryCount > 0;
    case 'archive':
      return input.memoryCount > 0;
    case 'review':
      return input.publicMemoryCount > 0 && input.pendingFamilyQuestionCount === 0;
    case 'persona':
      return input.speechProfileReady;
    case 'autobiography':
      return input.autobiographyChapterCount > 0;
  }
}

function isStageLocked(stageId: JourneyStageId, input: JourneyInput): boolean {
  if (stageId === 'record') return false;
  if (stageId === 'autobiography') return input.publicMemoryCount === 0;
  return input.memoryCount === 0;
}

export function getNextJourneyAction(input: JourneyInput): JourneyAction {
  if (input.memoryCount === 0) {
    return { route: '/', label: '첫 회상 기록' };
  }
  if (input.pendingFamilyQuestionCount > 0) {
    return { route: '/review', label: '가족 질문 확인' };
  }
  if (input.publicMemoryCount === 0) {
    return { route: '/review', label: '공개 범위 확인' };
  }
  if (!input.speechProfileReady) {
    return { route: '/persona', label: '분신 대화 준비' };
  }
  if (input.autobiographyChapterCount === 0) {
    return { route: '/autobiography', label: '자서전 초안 만들기' };
  }
  return { route: '/archive', label: '보관함 살펴보기' };
}

export function buildUserJourney(input: JourneyInput): UserJourneyState {
  const currentStageId = getCurrentJourneyStageId(input.pathname);
  const stages = STAGE_DEFINITIONS.map((stage): JourneyStage => {
    if (stage.id === currentStageId) {
      return { ...stage, status: 'active' };
    }
    if (isStageLocked(stage.id, input)) {
      return { ...stage, status: 'locked' };
    }
    if (isStageDone(stage.id, input)) {
      return { ...stage, status: 'done' };
    }
    return { ...stage, status: 'ready' };
  });

  return {
    stages,
    currentStageId,
    nextAction: getNextJourneyAction(input),
  };
}
