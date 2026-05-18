import { describe, expect, it } from 'vitest';
import { buildUserJourney, getCurrentJourneyStageId, getNextJourneyAction } from './user-journey';

describe('user journey helpers', () => {
  it('maps routes to journey stages', () => {
    expect(getCurrentJourneyStageId('/')).toBe('record');
    expect(getCurrentJourneyStageId('/archive')).toBe('archive');
    expect(getCurrentJourneyStageId('/review')).toBe('review');
    expect(getCurrentJourneyStageId('/persona')).toBe('persona');
    expect(getCurrentJourneyStageId('/autobiography')).toBe('autobiography');
    expect(getCurrentJourneyStageId('/settings')).toBe('record');
  });

  it('keeps new users focused on recording the first memory', () => {
    const journey = buildUserJourney({
      pathname: '/',
      memoryCount: 0,
      publicMemoryCount: 0,
      pendingFamilyQuestionCount: 0,
      speechProfileReady: false,
      autobiographyChapterCount: 0,
    });

    expect(journey.nextAction).toEqual({ route: '/', label: '첫 회상 기록' });
    expect(journey.stages.find((stage) => stage.id === 'record')).toMatchObject({ status: 'active' });
    expect(journey.stages.find((stage) => stage.id === 'archive')).toMatchObject({ status: 'locked' });
  });

  it('prioritizes family review before downstream generation', () => {
    expect(getNextJourneyAction({
      pathname: '/archive',
      memoryCount: 2,
      publicMemoryCount: 0,
      pendingFamilyQuestionCount: 0,
      speechProfileReady: false,
      autobiographyChapterCount: 0,
    })).toEqual({ route: '/review', label: '공개 범위 확인' });

    expect(getNextJourneyAction({
      pathname: '/archive',
      memoryCount: 2,
      publicMemoryCount: 1,
      pendingFamilyQuestionCount: 1,
      speechProfileReady: true,
      autobiographyChapterCount: 0,
    })).toEqual({ route: '/review', label: '가족 질문 확인' });
  });

  it('moves from persona readiness to autobiography creation', () => {
    expect(getNextJourneyAction({
      pathname: '/persona',
      memoryCount: 3,
      publicMemoryCount: 2,
      pendingFamilyQuestionCount: 0,
      speechProfileReady: false,
      autobiographyChapterCount: 0,
    })).toEqual({ route: '/persona', label: '분신 대화 준비' });

    expect(getNextJourneyAction({
      pathname: '/persona',
      memoryCount: 3,
      publicMemoryCount: 2,
      pendingFamilyQuestionCount: 0,
      speechProfileReady: true,
      autobiographyChapterCount: 0,
    })).toEqual({ route: '/autobiography', label: '자서전 초안 만들기' });
  });
});
