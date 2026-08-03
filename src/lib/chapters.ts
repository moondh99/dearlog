import { FIXED_CHAPTERS } from '../../server/domain/constants'
import type { Chapter } from '../types/interview'

/**
 * 챕터 제목의 유일한 출처는 서버의 FIXED_CHAPTERS 다. 예전에는 화면·스토어·데모 시드가
 * 각자 제목 목록을 들고 있어 같은 id 에 서로 다른 제목이 붙었다. 특히 hobbies 는
 * '취미'(서버)와 '일과 삶'(화면)으로 뜻 자체가 갈렸고, 화면 쪽 목록에는 adolescence 와
 * relationships 가 아예 없었다. 이 제목은 책 목차에 그대로 찍히는 값이다.
 *
 * 설명문은 DB Chapter 스키마에 없어 화면 쪽에만 있는 값이므로 여기에 둔다.
 */
const CHAPTER_DESCRIPTIONS: Record<string, string> = {
  childhood: '태어나서 학교에 들어가기 전까지의 기억',
  adolescence: '친구들과 함께 웃고 성장하던 학창 시절',
  youth: '20~30대 사회에 첫 발을 내딛던 시절',
  family_home: '사랑하는 가족과 함께한 소중한 순간들',
  hobbies: '오래 좋아해 온 취미와 즐거움',
  relationships: '살아오며 만난 소중한 인연들과의 기억',
  messages: '세월이 담긴 삶의 이야기와 조언',
}

export const CHAPTERS: Array<Omit<Chapter, 'questions'>> = FIXED_CHAPTERS.map((chapter) => ({
  id: chapter.id,
  title: chapter.title,
  description: CHAPTER_DESCRIPTIONS[chapter.id] ?? '',
  order: chapter.order,
}))

export function chapterTitleOf(chapterId: string, fallback = '기타'): string {
  return CHAPTERS.find((chapter) => chapter.id === chapterId)?.title ?? fallback
}

export function chapterDescriptionOf(chapterId: string, fallback = ''): string {
  return CHAPTERS.find((chapter) => chapter.id === chapterId)?.description ?? fallback
}
