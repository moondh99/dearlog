import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GhostwriterResult, Paragraph, ReliabilityLabel, ToneProfile } from '../types/agents'
import { fetchLocalAutobiographyDraft, saveLocalAutobiographyDraft, clearLocalAutobiographyDraft } from '../lib/local-server'

const FALLBACK_TONE_PROFILE: ToneProfile = {
  name: '기록집 문체',
  patterns: [],
}

const RELIABILITY_LABELS = new Set<ReliabilityLabel>(['CONFIRMED', 'ESTIMATED', 'UNVERIFIED'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function normalizeReliability(value: unknown): ReliabilityLabel {
  return typeof value === 'string' && RELIABILITY_LABELS.has(value as ReliabilityLabel)
    ? value as ReliabilityLabel
    : 'UNVERIFIED'
}

function normalizeToneProfile(value: unknown): ToneProfile {
  if (!isRecord(value)) return FALLBACK_TONE_PROFILE
  return {
    name: typeof value.name === 'string' && value.name.trim() ? value.name : FALLBACK_TONE_PROFILE.name,
    patterns: normalizeStringArray(value.patterns),
  }
}

function normalizeParagraph(value: unknown, chapterId: string, index: number): Paragraph | null {
  if (!isRecord(value) || typeof value.text !== 'string' || !value.text.trim()) return null
  return {
    paragraphId: typeof value.paragraphId === 'string' && value.paragraphId.trim()
      ? value.paragraphId
      : `${chapterId}_paragraph_${index + 1}`,
    text: value.text,
    sourceChunkIds: normalizeStringArray(value.sourceChunkIds),
    reliability: normalizeReliability(value.reliability),
    uncertaintyNote: typeof value.uncertaintyNote === 'string' ? value.uncertaintyNote : undefined,
  }
}

export function normalizeAutobiographyNarratives(value: unknown): GhostwriterResult[] {
  if (!Array.isArray(value)) return []

  return value
    .map((chapter, chapterIndex): GhostwriterResult | null => {
      if (!isRecord(chapter)) return null
      const chapterId = typeof chapter.chapterId === 'string' && chapter.chapterId.trim()
        ? chapter.chapterId
        : `chapter_${chapterIndex + 1}`
      const chapterTitle = typeof chapter.chapterTitle === 'string' && chapter.chapterTitle.trim()
        ? chapter.chapterTitle
        : `${chapterIndex + 1}장`
      const paragraphs = Array.isArray(chapter.paragraphs)
        ? chapter.paragraphs
          .map((paragraph, paragraphIndex) => normalizeParagraph(paragraph, chapterId, paragraphIndex))
          .filter((paragraph): paragraph is Paragraph => Boolean(paragraph))
        : []

      return {
        chapterId,
        chapterTitle,
        paragraphs,
        missingSections: normalizeStringArray(chapter.missingSections),
        toneProfile: normalizeToneProfile(chapter.toneProfile),
      }
    })
    .filter((chapter): chapter is GhostwriterResult => Boolean(chapter))
}

interface AutobiographyState {
  chapters: GhostwriterResult[]
  fetchDraft: (seniorId?: string | null) => Promise<void>
  setChapter: (result: GhostwriterResult, seniorId?: string | null) => Promise<void>
  clearAll: (seniorId?: string | null) => Promise<void>
}

export const useAutobiographyStore = create<AutobiographyState>()(
  persist(
    (set, get) => ({
      chapters: [],

      fetchDraft: async (seniorId) => {
        try {
          const res = await fetchLocalAutobiographyDraft(seniorId)
          set({ chapters: normalizeAutobiographyNarratives(res?.draft?.narratives) })
        } catch (e) {
          console.error('fetchDraft error:', e)
        }
      },

      setChapter: async (result, seniorId) => {
        set((state) => {
          const idx = state.chapters.findIndex((c) => c.chapterId === result.chapterId)
          let updatedChapters = []
          if (idx >= 0) {
            updatedChapters = [...state.chapters]
            updatedChapters[idx] = result
          } else {
            updatedChapters = [...state.chapters, result]
          }
          return { chapters: updatedChapters }
        })

        try {
          const currentChapters = get().chapters
          const structure = {
            chapters: currentChapters.map((ch) => ({ id: ch.chapterId, title: ch.chapterTitle }))
          }
          await saveLocalAutobiographyDraft({
            structure,
            narratives: currentChapters
          }, seniorId)
        } catch (e) {
          console.error('setChapter backend sync error:', e)
        }
      },

      clearAll: async (seniorId) => {
        set({ chapters: [] })
        try {
          await clearLocalAutobiographyDraft(seniorId)
        } catch (e) {
          console.error('clearAll backend sync error:', e)
        }
      },
    }),
    { name: 'dearlog-autobiography' }
  )
)
