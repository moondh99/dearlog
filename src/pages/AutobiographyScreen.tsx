import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ClipboardCheck, Palette, PencilLine } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ActiveSeniorContextBar, MissingSeniorState } from '../components/ActiveSeniorContextBar'
import { PublicationBookPreview } from '../components/PublicationBookPreview'
import { useActiveSeniorContext } from '../hooks/useActiveSeniorContext'
import { normalizeAutobiographyNarratives, useAutobiographyStore } from '../store/autobiographyStore'
import { useInterviewStore } from '../store/interviewStore'
import { useAuthStore } from '../store/authStore'
import { useDevModeStore } from '../store/devModeStore'
import { generateChapterDraft, buildMemoryChunksFromTranscripts } from '../lib/agents/ghostwriter'
import {
  confirmLocalCoverDesign,
  fetchLocalFileBlob,
  generateLocalCoverDesign,
  requestLocalPublication,
  type LocalCoverCandidate,
} from '../lib/local-server'
import type { GhostwriterResult, MemoryChunk, Paragraph, ReliabilityLabel, ToneProfile } from '../types/agents'
import chapterHero from '../assets/figma/autobiography-chapter-hero.jpg'
import toneStyleBookIcon from '../assets/figma/tone-style-book-icon.png'

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
const EMPTY_EMOTIONS = {
  pride: 0,
  nostalgia: 0,
  regret: 0,
  gratitude: 0,
  loss: 0,
  joy: 0,
  fear: 0,
  peace: 0,
}

type TonePresetId = 'news' | 'story' | 'interview'

type TonePreset = {
  id: TonePresetId
  title: string
  description: string
  example: string
  tags: string
  profile: ToneProfile
}

const TONE_PRESETS: TonePreset[] = [
  {
    id: 'news',
    title: '뉴스 기사 형태',
    description: '객관적이고 정리된 문장으로, 한 사람의 삶을 기사처럼 담아요.',
    example: '"현정은 식품영양학과를 졸업한 뒤, 외국계 회사에서 첫 사회생활을 시작했다."',
    tags: '정돈된 느낌 · 객관적 · 담백함',
    profile: {
      name: '뉴스 기사 형태',
      patterns: ['기사체', '객관적 사실 중심', '감정 과장을 줄인 담백한 문장'],
    },
  },
  {
    id: 'story',
    title: '이야기책 형태',
    description: '따뜻한 서술형 문장으로, 엄마의 삶을 한 권의 이야기처럼 풀어내요.',
    example: '"현정은 처음 일을 시작하던 날, 설렘과 걱정을 함께 안고 회사로 향했습니다."',
    tags: '따뜻함 · 서술형 · 자서전 느낌',
    profile: {
      name: '이야기책 형태',
      patterns: ['따뜻한 서술형', '자서전 문체', '장면과 감정을 자연스럽게 연결'],
    },
  },
  {
    id: 'interview',
    title: '인터뷰 형태',
    description: '엄마가 직접 들려주는 말투로, 생생한 대화 기록처럼 담아요.',
    example: '"처음엔 참 많이 긴장했어. 그래도 어렵게 시작한 일이니까 잘해보고 싶었지."',
    tags: '직접 말하는 느낌 · 생생함 · 자연스러움',
    profile: {
      name: '인터뷰 형태',
      patterns: ['1인칭 구술체', '직접 말하는 듯한 회상', '자연스러운 대화 기록'],
    },
  },
]

const DEFAULT_TONE = TONE_PRESETS[1].profile

const RELIABILITY_LABEL: Record<ReliabilityLabel, string> = {
  CONFIRMED: '확인됨',
  ESTIMATED: '추정됨',
  UNVERIFIED: '미검증',
}

function chapterNumber(index: number) {
  return `${index + 1}장`
}

function getChapterSubtitle(chapter: GhostwriterResult) {
  if (chapter.missingSections.length > 0) {
    return `${chapter.paragraphs.length}개 문단 · ${chapter.missingSections.length}개 보완 필요`
  }
  if (chapter.toneProfile?.name) {
    return `${chapter.toneProfile.name}로 정리된 이야기`
  }
  return `${chapter.paragraphs.length}개 문단 · 구간 완성`
}

function getSourceLabel(paragraph?: Paragraph) {
  if (!paragraph || paragraph.sourceChunkIds.length === 0) return '출처: 가족 검수 전 초안'
  const reliability = RELIABILITY_LABEL[paragraph.reliability]
  return `출처: 기억 ${paragraph.sourceChunkIds.length}개 · ${reliability}`
}

function buildMemoryChunksFromDraftChapters(
  chapters: GhostwriterResult[],
): Array<MemoryChunk & { chunkId: string }> {
  return chapters.flatMap((chapter) =>
    chapter.paragraphs.map((paragraph) => ({
      chunkId: paragraph.paragraphId,
      raw: paragraph.text,
      clean: paragraph.text,
      tags: {
        ner: { persons: [], places: [], times: [], events: [] },
        emotions: { ...EMPTY_EMOTIONS },
      },
      reliabilityLabel: paragraph.reliability,
      chapterHint: chapter.chapterId,
    })),
  )
}

function MissingSections({ sections }: { sections: string[] }) {
  if (sections.length === 0) return null

  return (
    <div className="mx-6 mt-7 border-y border-[#E0DBE8] py-5">
      <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#9485BE]">
        더 채울 기억
      </p>
      <div className="mt-3 space-y-2">
        {sections.map((section) => (
          <p key={section} className="rounded-[14px] border border-dashed border-[#E0DBE8] bg-white/60 px-4 py-3 text-[12px] leading-[20px] text-[#7A767F]">
            {section}
          </p>
        ))}
      </div>
    </div>
  )
}

function EmptyChapter() {
  return (
    <div className="mx-6 mt-8 rounded-[16px] border border-dashed border-[#E0DBE8] bg-white/70 px-5 py-8 text-center">
      <p className="text-[15px] font-medium leading-[22.5px] text-[#2A2830]">아직 생성된 자서전 초안이 없어요</p>
      <p className="mt-2 text-[12px] leading-[20px] text-[#7A767F]">
        아래 버튼으로 지금까지 모은 답변을 자서전 초안으로 엮어볼 수 있어요.
      </p>
    </div>
  )
}

const COVER_PREVIEW_THEMES: Record<string, { accent: string; paper: string; ink: string; muted: string }> = {
  warm_archive: { accent: '#9B6F4E', paper: '#F6F1E9', ink: '#2B2723', muted: '#CDB99E' },
  quiet_blue: { accent: '#647D9A', paper: '#F3F6F8', ink: '#202833', muted: '#B8C6D3' },
  classic_ink: { accent: '#2F3437', paper: '#F7F5EF', ink: '#202020', muted: '#C8C2B4' },
}

function CoverCandidatePreview({
  candidate,
  index,
  ownerName,
  selected,
  onSelect,
}: {
  candidate: LocalCoverCandidate
  index: number
  ownerName: string
  selected: boolean
  onSelect: () => void
}) {
  const { coverDesign } = candidate
  const theme = COVER_PREVIEW_THEMES[coverDesign.palette] ?? COVER_PREVIEW_THEMES.warm_archive
  const bookTitle = `${ownerName || '가족'}의 이야기`
  const serif = coverDesign.font.includes('명조') || coverDesign.font.includes('궁서')

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`표지 후보 ${index + 1} 선택`}
      aria-pressed={selected}
      className={`relative w-[132px] shrink-0 snap-start rounded-[12px] border bg-white p-1.5 text-left transition active:scale-[0.99] ${
        selected
          ? 'border-[#9485BE] shadow-[0_10px_28px_rgba(148,133,190,0.24)]'
          : 'border-[#E0DBE8] shadow-[0_8px_20px_rgba(42,40,48,0.05)]'
      }`}
    >
      <span
        className="relative block aspect-[3/4.2] overflow-hidden rounded-[10px]"
        style={{ backgroundColor: theme.paper, color: theme.ink }}
      >
        {coverDesign.template === 'photo_plate' ? (
          <>
            <span className="absolute inset-x-3 top-4 h-[52px] rounded-[7px] border" style={{ borderColor: theme.muted, backgroundColor: theme.muted }} />
            <span className="absolute left-6 top-8 h-6 w-6 rounded-full bg-white/45" />
            <span className="absolute right-6 top-9 h-5 w-5 rounded-full bg-white/35" />
          </>
        ) : null}
        {coverDesign.template === 'chapter_band' ? (
          <span className="absolute inset-x-0 top-[56px] h-[42px]" style={{ backgroundColor: theme.accent }} />
        ) : null}
        {coverDesign.template === 'letterpress' ? (
          <>
            <span className="absolute inset-3 rounded-[9px] border" style={{ borderColor: theme.accent }} />
            <span className="absolute left-1/2 top-9 h-px w-8 -translate-x-1/2" style={{ backgroundColor: theme.accent }} />
            <span className="absolute bottom-9 left-1/2 h-px w-8 -translate-x-1/2" style={{ backgroundColor: theme.accent }} />
          </>
        ) : null}
        {coverDesign.template === 'framed_portrait' ? (
          <>
            <span className="absolute inset-x-[24px] top-5 h-[48px] rounded-full border-[5px]" style={{ borderColor: theme.muted }} />
            <span className="absolute inset-x-4 top-4 h-[66px] rounded-t-[42px] border" style={{ borderColor: theme.accent }} />
          </>
        ) : null}
        <span
          className={`absolute inset-x-5 text-center text-[8px] font-semibold uppercase leading-3 tracking-[0.24em] ${
            coverDesign.template === 'photo_plate' ? 'top-[74px]' : 'top-6'
          }`}
          style={{ color: coverDesign.template === 'chapter_band' ? '#FFFFFF' : theme.accent }}
        >
          Dearlog
        </span>
        <span
          className={`absolute left-3 right-3 block text-center text-[12px] font-semibold leading-[1.22] ${
            serif ? 'font-serif' : ''
          } ${
            coverDesign.template === 'chapter_band'
              ? 'top-[66px] text-white'
              : coverDesign.template === 'photo_plate'
                ? 'top-[88px]'
                : 'top-[76px]'
          }`}
          style={{
            color: coverDesign.template === 'chapter_band' ? '#FFFFFF' : theme.ink,
            wordBreak: 'keep-all',
            overflowWrap: 'normal',
          }}
        >
          {bookTitle}
        </span>
        <span
          className="absolute bottom-6 left-1/2 h-px w-8 -translate-x-1/2"
          style={{ backgroundColor: coverDesign.template === 'chapter_band' ? '#FFFFFF' : theme.accent }}
        />
        <span
          className="absolute bottom-3 left-0 right-0 text-center text-[8px] font-medium leading-3"
          style={{ color: coverDesign.template === 'chapter_band' ? '#FFFFFF' : theme.accent }}
        >
          가족 기록집
        </span>
      </span>
      <span className="sr-only">후보 {index + 1}</span>
      <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-white/85 shadow-[0_2px_8px_rgba(42,40,48,0.12)]">
        <span className={`h-2.5 w-2.5 rounded-full ${selected ? 'bg-[#9485BE]' : 'bg-[#DCD6E5]'}`} />
      </span>
    </button>
  )
}

function CoverRecommendationPanel({
  confirmed,
  candidates,
  error,
  isConfirming,
  onCandidateSelect,
  onConfirm,
  ownerName,
  selectedCandidateId,
}: {
  candidates: LocalCoverCandidate[]
  confirmed: boolean
  error: string | null
  isConfirming: boolean
  onCandidateSelect: (coverDesignId: string) => void
  onConfirm: () => void
  ownerName: string
  selectedCandidateId: string | null
}) {
  if (candidates.length === 0 && !error) return null
  const selected = candidates.find((candidate) => candidate.coverDesign.id === selectedCandidateId) ?? candidates[0] ?? null

  return (
    <section className="mx-4 mt-4 rounded-[16px] border border-[#E0DBE8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(42,40,48,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#9485BE]">
            표지 후보
          </p>
          <h2 className="mt-1 text-[16px] font-semibold leading-6 text-[#2A2830]">
            마음에 드는 표지를 골라주세요
          </h2>
        </div>
        {selected ? (
          <span className="shrink-0 rounded-full bg-[#F1ECFA] px-3 py-1 text-[11px] font-semibold leading-4 text-[#6E56A5]">
            {confirmed ? '확정됨' : '추천됨'}
          </span>
        ) : null}
      </div>

      {candidates.length > 0 ? (
        <div
          data-testid="cover-candidate-scroller"
          className="-mx-1 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-2"
        >
          {candidates.map((candidate, index) => (
            <CoverCandidatePreview
              key={candidate.coverDesign.id}
              candidate={candidate}
              index={index}
              ownerName={ownerName}
              selected={candidate.coverDesign.id === selected?.coverDesign.id}
              onSelect={() => onCandidateSelect(candidate.coverDesign.id)}
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-[12px] bg-[#FCEEEE] px-3 py-2 text-[12px] font-medium leading-5 text-[#B94E4E]">
          {error}
        </p>
      ) : null}

      {selected ? (
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmed || isConfirming}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-[12px] bg-[#2A2830] px-4 text-[13px] font-medium leading-5 text-[#F7F5FB] transition active:scale-[0.99] disabled:bg-[#CFC8DA]"
        >
          {confirmed ? '선택한 표지로 확정됐어요' : isConfirming ? '표지 확정 중...' : '선택한 표지로 확정'}
        </button>
      ) : null}
    </section>
  )
}

function ToneSelectionScreen({
  selectedToneId,
  onSelect,
}: {
  selectedToneId: TonePresetId
  onSelect: (id: TonePresetId) => void
}) {
  return (
    <>
      <section className="px-6 pb-4">
        <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
          문체 선택
        </p>
        <h1
          className="mt-2 whitespace-nowrap text-[24px] font-normal leading-9 text-[#2A2830]"
          style={{ fontFamily: "'Noto Serif KR', serif" }}
        >
          어떤 문체로 책을 만들까요?
        </h1>
        <p className="mt-1 text-[12px] font-normal leading-[18px] text-[#7A767F]">
          같은 기록도 문체에 따라 전혀 다른 책처럼 느껴져요.
          <br />
          엄마의 이야기에 어울리는 스타일을 골라주세요.
        </p>
      </section>

      <section className="px-5 pb-8">
        <div className="space-y-3">
          {TONE_PRESETS.map((preset) => {
            const selected = preset.id === selectedToneId

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelect(preset.id)}
                aria-pressed={selected}
                className={`w-full rounded-[16px] border-[1.5px] bg-white px-[14px] py-[12px] text-left transition active:scale-[0.99] ${
                  selected ? 'border-[#9485BE] shadow-[0_6px_18px_rgba(148,133,190,0.16)]' : 'border-[#DDD7EF]'
                }`}
              >
                <div className="flex gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#E0DBE8]">
                    <img
                      src={toneStyleBookIcon}
                      alt=""
                      className="h-10 w-8 object-cover object-center"
                    />
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span
                      className="block text-[15px] font-medium leading-5 text-black"
                      style={{ fontFamily: "'Noto Serif KR', serif" }}
                    >
                      {preset.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] font-normal leading-[20.4px] text-[#2A2830]/80">
                      {preset.description}
                    </span>
                  </span>
                </div>

                <span className="mt-4 block rounded-[14px] bg-[#E0DBE8]/50 px-4 py-3 text-[14px] font-medium leading-[22.75px] text-[#364153]">
                  {preset.example}
                </span>

                <span className="mt-3 block text-[12px] font-medium leading-4 text-[#2A2830]/50">
                  {preset.tags}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}

function ChapterReader({
  chapter,
  chapterIndex,
}: {
  chapter: GhostwriterResult
  chapterIndex: number
}) {
  const lead = chapter.paragraphs[0]
  const quote = chapter.paragraphs.length > 1 ? chapter.paragraphs[1] : null
  const remaining = chapter.paragraphs.slice(quote ? 2 : 1)
  const sourceParagraph = quote || lead

  return (
    <>
      <section className="relative h-[240px] overflow-hidden">
        <img
          src={chapterHero}
          alt=""
          className="h-[194px] w-full object-cover"
        />
        <div className="absolute inset-x-0 top-[-7px] h-[240px] bg-gradient-to-b from-black/10 from-[50%] to-[#F8F6F9] to-[78%]" />
        <div className="absolute left-6 right-6 top-[181px]">
          <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
            {chapterNumber(chapterIndex)}
          </p>
          <h1 className="mt-1 truncate font-serif text-[22px] font-normal leading-[33px] text-[#2A2830]">
            {chapter.chapterTitle}
          </h1>
        </div>
      </section>

      <section className="px-6">
        <p className="text-[12px] font-normal leading-[18px] text-[#7A767F]">
          {getChapterSubtitle(chapter)}
        </p>

        {lead ? (
          <p className="mt-5 font-serif text-[14px] font-normal leading-7 text-[#2A2830]">
            {lead.text}
          </p>
        ) : (
          <EmptyChapter />
        )}
      </section>

      {quote ? (
        <section className="mx-6 mt-7 border-y border-[#E0DBE8] py-[25px]">
          <p className="text-[11px] font-normal uppercase leading-[16.5px] tracking-[2.75px] text-[#9485BE]">
            &quot; 기억
          </p>
          <p className="mt-3 font-serif text-[18px] font-normal leading-[27.9px] text-[#2A2830]">
            {quote.text}
          </p>
        </section>
      ) : null}

      <section className="px-6 pt-7">
        {remaining.map((paragraph) => (
          <p key={paragraph.paragraphId} className="mb-7 font-serif text-[14px] font-normal leading-7 text-[#2A2830]">
            {paragraph.text}
          </p>
        ))}
      </section>

      <MissingSections sections={chapter.missingSections} />

      <div className="mx-6 mt-7 flex items-center gap-2 pb-6">
        <span className="h-px min-w-0 flex-1 bg-[#E0DBE8]" />
        <p className="shrink-0 text-[10px] font-normal uppercase leading-[15px] tracking-[1.5px] text-[#7A767F]">
          {getSourceLabel(sourceParagraph)}
        </p>
        <span className="h-px min-w-0 flex-1 bg-[#E0DBE8]" />
      </div>
    </>
  )
}

export default function AutobiographyScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<number | null>(null)
  const { chapters: rawChapters, fetchDraft, setChapter } = useAutobiographyStore()
  const {
    chapters: interviewChapters,
    transcripts,
    fetchChaptersAndQuestions,
    fetchTranscripts,
  } = useInterviewStore()
  const { role, userName } = useAuthStore()
  const isOfflineDemo = useDevModeStore((state) => state.isOfflineDemo)
  const incomingSeniorId = (location.state as { seniorId?: string | null } | null)?.seniorId ?? null
  const {
    activeSenior,
    activeSeniorId,
    loading: seniorLoading,
    seniors,
    setActiveSeniorId,
  } = useActiveSeniorContext({
    enabled: role === 'child',
    preferredSeniorId: incomingSeniorId,
  })
  const previewSeniorId = role === 'child' ? activeSeniorId : null

  useEffect(() => {
    if (role === 'child' && !activeSeniorId) return
    if (isOfflineDemo) return
    void fetchDraft(previewSeniorId)
    void fetchChaptersAndQuestions()
    void fetchTranscripts()
  }, [activeSeniorId, fetchChaptersAndQuestions, fetchDraft, fetchTranscripts, isOfflineDemo, previewSeniorId, role])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const [activeIdx, setActiveIdx] = useState(0)
  const [viewMode, setViewMode] = useState<'preview' | 'tone' | 'reader'>('preview')
  const [selectedToneId, setSelectedToneId] = useState<TonePresetId>('story')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false)
  const [coverCandidates, setCoverCandidates] = useState<LocalCoverCandidate[]>([])
  const [selectedCoverDesignId, setSelectedCoverDesignId] = useState<string | null>(null)
  const [coverError, setCoverError] = useState<string | null>(null)
  const [confirmedCoverDesignId, setConfirmedCoverDesignId] = useState<string | null>(null)
  const [isGeneratingCover, setIsGeneratingCover] = useState(false)
  const [isConfirmingCover, setIsConfirmingCover] = useState(false)
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const requestRole = role === 'parent' ? 'senior' : 'guardian'

  const chapters = useMemo(() => normalizeAutobiographyNarratives(rawChapters), [rawChapters])
  // 출판 동의를 철회한 기록은 초안 생성에서도 뺍니다. 서버 출판 파이프라인은 publish=true만
  // 읽지만, 여기서 만든 초안은 autobiography/draft로 저장돼 다시 출판 입력으로 들어가므로
  // 여기를 거르지 않으면 철회한 이야기가 초안을 통해 책에 되돌아옵니다.
  const publishableTranscripts = useMemo(
    () => transcripts.filter((transcript) => transcript.publish !== false),
    [transcripts],
  )
  const transcriptMemoryChunks = useMemo(
    () => buildMemoryChunksFromTranscripts(publishableTranscripts),
    [publishableTranscripts],
  )
  const draftMemoryChunks = useMemo(() => buildMemoryChunksFromDraftChapters(chapters), [chapters])
  const hasInterviewMaterial = transcriptMemoryChunks.length > 0 || draftMemoryChunks.length > 0
  const selectedTone = useMemo(
    () => TONE_PRESETS.find((preset) => preset.id === selectedToneId) ?? TONE_PRESETS[1],
    [selectedToneId],
  )

  useEffect(() => {
    if (chapters.length > 0 && activeIdx >= chapters.length) {
      setActiveIdx(chapters.length - 1)
    }
  }, [activeIdx, chapters.length])

  useEffect(() => {
    setCoverCandidates([])
    setSelectedCoverDesignId(null)
    setCoverError(null)
    setConfirmedCoverDesignId(null)
  }, [previewSeniorId])

  const activeChapter = chapters[activeIdx]
  const ownerName = role === 'child'
    ? activeSenior?.name || activeSenior?.displayName || '부모님'
    : userName || '이름 미설정'
  const fileName = `dearlog_자서전_${ownerName || '이름없음'}_A5.pdf`
  const lastChapter = activeIdx >= chapters.length - 1
  const canExport = chapters.length > 0 && !isExporting
  const isPreview = viewMode === 'preview' && chapters.length > 0 && !isOfflineDemo
  const isToneSelection = viewMode === 'tone'
  const isCompactHeader = isPreview || isToneSelection
  const contextBar = role === 'child' ? (
    <ActiveSeniorContextBar
      activeSenior={activeSenior}
      activeSeniorId={activeSeniorId}
      loading={seniorLoading}
      onChange={setActiveSeniorId}
      seniors={seniors}
    />
  ) : null

  const chapterProgressLabel = useMemo(() => {
    if (chapters.length === 0) return '자서전 초안'
    const roman = ROMAN_NUMERALS[activeIdx] || String(activeIdx + 1)
    return `${roman} / ${chapters.length}`
  }, [activeIdx, chapters.length])

  const showFeedback = (message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    setToastMessage(message)
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 1200)
  }

  const scrollPreviewToBottom = () => {
    window.setTimeout(() => {
      const node = scrollRef.current
      if (!node) return
      node.scrollTop = node.scrollHeight
      if (typeof node.scrollTo === 'function') {
        node.scrollTo({ top: node.scrollHeight, behavior: 'auto' })
      }
    }, 50)
  }

  useEffect(() => {
    if (!isPreview || (coverCandidates.length === 0 && !coverError)) return
    scrollPreviewToBottom()
  }, [coverCandidates.length, coverError, isPreview])

  const handleDownload = async (successMessage = 'PDF가 저장됐어요') => {
    if (!canExport) return
    setIsExporting(true)
    setExportError(null)
    try {
      const result = await requestLocalPublication('A5', previewSeniorId, requestRole, selectedTone.profile)
      const pdfFileKey = result.publicationRequest.pdfFileKey
      if (!pdfFileKey) {
        throw new Error('A5 PDF 파일 키가 응답에 없습니다')
      }
      const blob = await fetchLocalFileBlob(pdfFileKey)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      showFeedback(successMessage)
    } catch (error) {
      console.error('PDF export failed:', error)
      setExportError(error instanceof Error ? error.message : 'PDF 생성 중 오류가 발생했습니다')
    } finally {
      setIsExporting(false)
    }
  }

  const handleGenerateCover = async () => {
    if (isGeneratingCover || (role === 'child' && !previewSeniorId)) return
    setIsGeneratingCover(true)
    setCoverError(null)
    setExportError(null)
    setConfirmedCoverDesignId(null)
    try {
      const result = await generateLocalCoverDesign(previewSeniorId, requestRole, 3)
      const candidates = result.candidates ?? [{ coverDesign: result.coverDesign, analysis: result.analysis }]
      setCoverCandidates(candidates)
      setSelectedCoverDesignId(candidates[0]?.coverDesign.id ?? null)
      showFeedback('표지 후보를 만들었어요')
    } catch (error) {
      console.error('Cover generation failed:', error)
      setCoverCandidates([])
      setSelectedCoverDesignId(null)
      setCoverError('표지 후보를 만들지 못했어요')
    } finally {
      setIsGeneratingCover(false)
    }
  }

  const handleConfirmCover = async () => {
    const selectedCandidate = coverCandidates.find((candidate) => candidate.coverDesign.id === selectedCoverDesignId)
    if (!selectedCandidate || isConfirmingCover) return
    setIsConfirmingCover(true)
    setCoverError(null)
    setExportError(null)
    try {
      await confirmLocalCoverDesign(selectedCandidate.coverDesign.id, requestRole)
      setConfirmedCoverDesignId(selectedCandidate.coverDesign.id)
      setPreviewRefreshKey((key) => key + 1)
      showFeedback('표지를 확정했어요')
    } catch (error) {
      console.error('Cover confirmation failed:', error)
      setCoverError('표지를 확정하지 못했어요')
    } finally {
      setIsConfirmingCover(false)
    }
  }

  const handleGenerateDraft = async (toneProfile: ToneProfile = selectedTone.profile) => {
    if (isGeneratingDraft) return
    const hasTranscriptSource = transcriptMemoryChunks.length > 0
    const memoryChunks = hasTranscriptSource ? transcriptMemoryChunks : draftMemoryChunks
    const chaptersForGeneration = hasTranscriptSource && interviewChapters.length > 0
      ? interviewChapters
      : chapters.map((chapter) => ({ id: chapter.chapterId, title: chapter.chapterTitle }))

    if (memoryChunks.length === 0 || chaptersForGeneration.length === 0) {
      navigate(role === 'child' ? '/child/progress' : '/parent/progress', {
        state: role === 'child' ? { seniorId: activeSeniorId } : undefined,
      })
      return
    }
    setIsGeneratingDraft(true)
    setExportError(null)
    try {
      const results = await Promise.all(
        chaptersForGeneration.map((ch) =>
          generateChapterDraft(ch.id, ch.title, memoryChunks, toneProfile),
        ),
      )
      const withContent = results.filter((r) => r.paragraphs.length > 0)
      if (withContent.length === 0) {
        setExportError('아직 자서전으로 엮을 답변이 충분하지 않아요')
        return
      }
      for (const result of withContent) {
        await setChapter(result, previewSeniorId)
      }
      setViewMode('preview')
      setActiveIdx(0)
      setPreviewRefreshKey((key) => key + 1)
      showFeedback(`${toneProfile.name}로 책을 만들었어요`)
    } catch (error) {
      console.error('Autobiography draft generation failed:', error)
      setExportError('자서전 생성 중 오류가 발생했습니다')
    } finally {
      setIsGeneratingDraft(false)
    }
  }

  const handleBack = () => {
    if (viewMode === 'tone') {
      setViewMode('preview')
      return
    }
    if (viewMode === 'reader' && chapters.length > 0) {
      setViewMode('preview')
      window.requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      })
      return
    }
    navigate(-1)
  }

  const handleTonePick = () => {
    setViewMode('tone')
  }

  const handleApplyTone = () => {
    void handleGenerateDraft(selectedTone.profile)
  }

  const handleOpenReview = () => {
    if (role === 'child') {
      navigate('/child/autobiography/preview', { state: { seniorId: previewSeniorId } })
      return
    }
    navigate('/parent/autobiography/preview')
  }

  const handlePrimaryAction = () => {
    if (chapters.length === 0) {
      void handleGenerateDraft()
      return
    }
    if (!lastChapter) {
      setActiveIdx((index) => index + 1)
      setViewMode('reader')
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (isOfflineDemo) {
      setActiveIdx(0)
      showFeedback('발표용 자서전 초안을 모두 확인했어요')
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    void handleDownload()
  }

  if (role === 'child' && !seniorLoading && !activeSenior) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
        <MissingSeniorState onCreate={() => navigate('/child/record-space/new')} />
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-[#F8F6F9] text-[#2A2830]">
      <div
        className={
          isCompactHeader
            ? 'flex h-[44px] shrink-0 items-start px-6 pb-5 pt-2'
            : 'flex shrink-0 items-center justify-between px-6 pb-4 pt-2'
        }
      >
        <button
          type="button"
          onClick={handleBack}
          className={
            isCompactHeader
              ? '-ml-1 flex h-4 items-center justify-center gap-1 rounded-full text-[#7A767F] transition active:scale-95'
              : '-ml-2 flex h-11 items-center justify-center gap-1 rounded-full px-2 text-[#7A767F] transition active:scale-95'
          }
          aria-label="이전 화면으로 돌아가기"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {isCompactHeader ? (
            <span className="text-[12px] font-medium leading-4">뒤로</span>
          ) : null}
        </button>
        {!isCompactHeader ? (
          <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
            {chapterProgressLabel}
          </p>
        ) : null}
      </div>

      <main ref={scrollRef} className={`min-h-0 flex-1 overflow-y-auto ${isPreview ? 'pb-[196px]' : 'pb-[118px]'}`}>
        {!isPreview && !isToneSelection && contextBar ? <div className="px-6 pb-5">{contextBar}</div> : null}
        {isToneSelection ? (
          <ToneSelectionScreen selectedToneId={selectedToneId} onSelect={setSelectedToneId} />
        ) : isPreview ? (
          <>
            <PublicationBookPreview
              seniorId={previewSeniorId}
              refreshKey={previewRefreshKey}
              role={requestRole}
              toneProfile={selectedTone.profile}
              className="relative mx-4 h-[560px] overflow-hidden rounded-[18px] border border-[#DED7E6] bg-[#E6E0D8] shadow-[0_18px_50px_rgba(42,40,48,0.10)]"
            />
            <CoverRecommendationPanel
              candidates={coverCandidates}
              confirmed={Boolean(selectedCoverDesignId && confirmedCoverDesignId === selectedCoverDesignId)}
              error={coverError}
              isConfirming={isConfirmingCover}
              onCandidateSelect={(coverDesignId) => {
                setSelectedCoverDesignId(coverDesignId)
                setConfirmedCoverDesignId((confirmedId) => confirmedId === coverDesignId ? confirmedId : null)
              }}
              onConfirm={handleConfirmCover}
              ownerName={ownerName}
              selectedCandidateId={selectedCoverDesignId}
            />
          </>
        ) : activeChapter ? (
          <ChapterReader chapter={activeChapter} chapterIndex={activeIdx} />
        ) : (
          <>
            <section className="relative h-[240px] overflow-hidden">
              <img src={chapterHero} alt="" className="h-[194px] w-full object-cover" />
              <div className="absolute inset-x-0 top-[-7px] h-[240px] bg-gradient-to-b from-black/10 from-[50%] to-[#F8F6F9] to-[78%]" />
              <div className="absolute left-6 right-6 top-[181px]">
                <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
                  가족 기록집
                </p>
                <h1 className="mt-1 font-serif text-[22px] font-normal leading-[33px] text-[#2A2830]">
                  자서전 초안
                </h1>
              </div>
            </section>
            <EmptyChapter />
          </>
        )}
      </main>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[390px] -translate-x-1/2 bg-[#F8F6F9] px-6 pb-[32px] pt-4">
        {exportError ? (
          <p className="mb-2 text-center text-[12px] text-[#C94A4A]">{exportError}</p>
        ) : null}
        {isToneSelection ? (
          <button
            type="button"
            onClick={handleApplyTone}
            disabled={isGeneratingDraft}
            className="flex min-h-[51px] w-full items-center justify-center rounded-[14px] bg-[#2A2830] px-5 text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99] disabled:bg-[#CFC8DA]"
          >
            {isGeneratingDraft ? '책을 만들고 있어요...' : '이 문체로 책 만들기'}
          </button>
        ) : isPreview ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleTonePick}
                className="flex min-h-[51px] items-center justify-center gap-1 rounded-[14px] border border-[#E0DBE8] bg-white/75 px-1.5 text-[12px] font-medium leading-[18px] text-[#2A2830] transition active:scale-[0.99] disabled:text-[#A6A0AE]"
              >
                <PencilLine className="h-4 w-4 shrink-0 text-[#9485BE]" aria-hidden="true" />
                <span className="whitespace-nowrap">문체 고르기</span>
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateCover()}
                disabled={isGeneratingCover || isConfirmingCover}
                className="flex min-h-[51px] items-center justify-center gap-1 rounded-[14px] border border-[#E0DBE8] bg-white/75 px-1.5 text-[12px] font-medium leading-[18px] text-[#2A2830] transition active:scale-[0.99] disabled:text-[#A6A0AE]"
              >
                <Palette className="h-4 w-4 shrink-0 text-[#9485BE]" aria-hidden="true" />
                <span className="whitespace-nowrap">{isGeneratingCover ? '표지 생성 중' : '표지 고르기'}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenReview}
                className="flex min-h-[51px] items-center justify-center gap-1 rounded-[14px] border border-[#E0DBE8] bg-white/75 px-1.5 text-[12px] font-medium leading-[18px] text-[#2A2830] transition active:scale-[0.99]"
              >
                <ClipboardCheck className="h-4 w-4 shrink-0 text-[#9485BE]" aria-hidden="true" />
                <span className="whitespace-nowrap">검수하기</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleDownload('최종 기록집 PDF가 저장됐어요')}
              disabled={isExporting}
              className="flex min-h-[51px] w-full items-center justify-center rounded-[14px] bg-[#2A2830] px-5 text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99] disabled:bg-[#CFC8DA]"
            >
              {isExporting ? '완성본 생성 중...' : '최종 완성하기'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={(lastChapter && chapters.length > 0 && isExporting) || isGeneratingDraft}
            className="flex min-h-[51px] w-full items-center justify-center rounded-[14px] bg-[#2A2830] px-5 text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99] disabled:bg-[#CFC8DA]"
          >
            {chapters.length === 0
              ? isGeneratingDraft
                ? '자서전을 쓰고 있어요...'
                : hasInterviewMaterial
                  ? '자서전 생성하기'
                  : '기록 더 모으러 가기'
              : lastChapter
                ? isOfflineDemo
                  ? '처음부터 다시 보기'
                  : isExporting ? 'PDF 생성 중...' : '최종 완성하기'
                : '다음 챕터'}
          </button>
        )}
      </div>

      {toastMessage ? (
        <div className="fixed top-24 left-1/2 z-50 -translate-x-1/2 rounded-[14px] bg-[#2A2830] px-5 py-3 text-[13px] font-medium text-[#F7F5FB] shadow-[0_8px_24px_rgba(42,40,48,0.18)]">
          {toastMessage}
        </div>
      ) : null}
    </div>
  )
}
