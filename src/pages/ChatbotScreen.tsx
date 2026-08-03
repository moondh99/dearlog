import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Clock3, Plus, SendHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useInterviewStore } from '../store/interviewStore'
import { useAuthStore } from '../store/authStore'
import { useDevModeStore } from '../store/devModeStore'
import { buildMemoryChunksFromMemories, generatePersonaResponse } from '../lib/agents/digitalTwin'
import { buildMemoryChunksFromTranscripts } from '../lib/agents/ghostwriter'
import { fetchLocalMemories } from '../lib/local-server'
import { useActiveSeniorContext } from '../hooks/useActiveSeniorContext'
import type { Memory } from '../lib/types'
import type { DigitalTwinResult, MemoryChunk, ToneProfile } from '../types/agents'
import memoryChatAvatar from '../assets/figma/memory-chat-avatar.png'

const DEFAULT_TONE: ToneProfile = {
  name: '따뜻한 구어체',
  patterns: ['음...', '그래서', '참'],
}

const RELIABILITY_LABELS: Record<string, string> = {
  CONFIRMED: '확인됨',
  ESTIMATED: '추정됨',
  UNVERIFIED: '미확인',
}

interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
  result?: DigitalTwinResult
}

type MemoryChunkWithId = MemoryChunk & { chunkId: string }

type ChatSession = {
  id: string
  createdAt: string
  updatedAt: string
  ownerLabel: string
  messages: Message[]
}

const CHAT_HISTORY_STORAGE_PREFIX = 'dearlog-memory-chat-history'
const MAX_CHAT_SESSIONS = 12

function createWelcomeMessage(): Message {
  return {
    id: 'welcome',
    role: 'ai',
    text: '저장된 이야기만 바탕으로 답할게요. 부모님의 기억에 대해 편하게 물어보세요.',
  }
}

function getChatHistoryStorageKey(ownerKey: string) {
  return `${CHAT_HISTORY_STORAGE_PREFIX}:${ownerKey}`
}

function sanitizeStoredMessage(value: unknown): Message | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<Message>
  if (candidate.role !== 'user' && candidate.role !== 'ai') return null
  if (typeof candidate.text !== 'string' || !candidate.text.trim()) return null
  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `m_${Date.now()}`,
    role: candidate.role,
    text: candidate.text,
    result: candidate.result && typeof candidate.result === 'object'
      ? candidate.result as DigitalTwinResult
      : undefined,
  }
}

function sanitizeStoredSession(value: unknown): ChatSession | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<ChatSession>
  if (typeof candidate.id !== 'string' || !candidate.id) return null
  const messages = Array.isArray(candidate.messages)
    ? candidate.messages.map(sanitizeStoredMessage).filter((message): message is Message => Boolean(message))
    : []
  if (!messages.some((message) => message.role === 'user')) return null
  const now = new Date().toISOString()
  return {
    id: candidate.id,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : now,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : now,
    ownerLabel: typeof candidate.ownerLabel === 'string' ? candidate.ownerLabel : '기록 대화',
    messages,
  }
}

function readChatSessions(ownerKey: string): ChatSession[] {
  if (typeof window === 'undefined') return []
  try {
    const rawValue = window.localStorage.getItem(getChatHistoryStorageKey(ownerKey))
    const parsedValue = rawValue ? JSON.parse(rawValue) : []
    if (!Array.isArray(parsedValue)) return []
    return parsedValue
      .map(sanitizeStoredSession)
      .filter((session): session is ChatSession => Boolean(session))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_CHAT_SESSIONS)
  } catch {
    return []
  }
}

function writeChatSessions(ownerKey: string, sessions: ChatSession[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      getChatHistoryStorageKey(ownerKey),
      JSON.stringify(sessions.slice(0, MAX_CHAT_SESSIONS))
    )
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

// 챗봇 동의를 철회하면 그 뒤로는 근거로 쓰이지 않지만, 이미 인용문이 담긴 지난 대화가
// localStorage에 그대로 남는다. 서버가 지울 수 없는 저장소라 클라이언트가 지워야 한다.
// 메시지에는 출처 기록 id가 없으므로(DigitalTwinResult) 인용된 기록만 골라낼 수 없다.
// 그래서 세션 단위로 시점을 비교한다. 관계없는 세션까지 버려지지만, 틀린다면 남기는 쪽이
// 아니라 지우는 쪽으로 틀리는 편이 맞다.
function dropChatSessionsRevokedSince(ownerKey: string, revokedAt?: string | null) {
  const sessions = readChatSessions(ownerKey)
  const revokedTime = revokedAt ? new Date(revokedAt).getTime() : Number.NaN
  if (Number.isNaN(revokedTime)) return sessions

  const kept = sessions.filter((session) => new Date(session.updatedAt).getTime() > revokedTime)
  if (kept.length !== sessions.length) writeChatSessions(ownerKey, kept)
  return kept
}

function getChatSessionTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user')
  const title = firstUserMessage?.text.replace(/\s+/g, ' ').trim() || '이전 대화'
  return title.length > 28 ? `${title.slice(0, 27)}…` : title
}

function getChatSessionTurnCount(messages: Message[]) {
  return messages.filter((message) => message.role === 'user').length
}

function formatChatSessionDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '최근 대화'
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function getEvidenceSources(
  result: DigitalTwinResult | undefined,
  memoryChunks: MemoryChunkWithId[]
) {
  if (!result || result.fallbackTriggered) return []

  const seenSourceKeys = new Set<string>()
  const sources: MemoryChunkWithId[] = []

  for (const chunkId of result.evidenceBadge.usedChunkIds) {
    const source = memoryChunks.find((chunk) => chunk.chunkId === chunkId)
    if (!source) continue

    const sourceText = (source.raw || source.clean || '').replace(/\s+/g, ' ').trim()
    const sourceKey = sourceText || source.chunkId
    if (seenSourceKeys.has(sourceKey)) continue

    seenSourceKeys.add(sourceKey)
    sources.push(source)
  }

  return sources
}

function getChunkContentKey(chunk: MemoryChunkWithId) {
  const sourceText = [chunk.raw, chunk.clean]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return sourceText || chunk.chunkId
}

function mergeMemoryChunks(
  transcriptChunks: MemoryChunkWithId[],
  serverMemoryChunks: MemoryChunkWithId[]
) {
  const seen = new Set<string>()
  const merged: MemoryChunkWithId[] = []

  for (const chunk of [...transcriptChunks, ...serverMemoryChunks]) {
    const key = getChunkContentKey(chunk)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(chunk)
  }

  return merged
}

function getEvidenceLabel(sources: MemoryChunkWithId[], result?: DigitalTwinResult) {
  const firstSource = sources[0]
  if (firstSource?.chapterHint) return firstSource.chapterHint
  if (result?.evidenceBadge.usedChunkIds.length) {
    return `저장된 이야기 ${result.evidenceBadge.usedChunkIds.length}개`
  }
  return '저장된 이야기'
}

function EvidenceFooter({
  message,
  memoryChunks,
  expanded,
  onToggle,
}: {
  message: Message
  memoryChunks: MemoryChunkWithId[]
  expanded: boolean
  onToggle: () => void
}) {
  const sources = getEvidenceSources(message.result, memoryChunks)
  if (!message.result || message.result.fallbackTriggered || sources.length === 0) return null

  const reliability = RELIABILITY_LABELS[message.result.evidenceBadge.reliability]

  return (
    <div className="mt-2 max-w-[264px]">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 max-w-[178px] items-center gap-1.5 rounded-full border border-[#E0DBE8] bg-[#F7F5FB] px-[11px] py-[5px]">
          <BookOpen className="h-[9px] w-[9px] shrink-0 text-[#9485BE]" aria-hidden="true" />
          <span className="truncate text-[10px] font-medium leading-[15px] tracking-[0.5px] text-[#7A767F]">
            {getEvidenceLabel(sources, message.result)}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-[10px] font-medium leading-[15px] text-[#9485BE] underline decoration-solid underline-offset-2"
        >
          {expanded ? '닫기' : '원문 보기'}
        </button>
      </div>

      {expanded ? (
        <div className="mt-2 rounded-[12px] border border-[#E0DBE8] bg-white/75 px-3 py-3">
          <p className="text-[10px] font-medium leading-[15px] tracking-[0.5px] text-[#9485BE]">
            원문 · {reliability}
          </p>
          <div className="mt-2 space-y-2">
            {sources.map((source) => (
              <p key={source.chunkId} className="font-serif text-[12px] font-normal leading-[20px] text-[#2A2830]">
                {source.raw || source.clean}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MessageBubble({
  message,
  memoryChunks,
  expanded,
  onToggleSource,
}: {
  message: Message
  memoryChunks: MemoryChunkWithId[]
  expanded: boolean
  onToggleSource: () => void
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[264px] rounded-bl-[16px] rounded-br-[16px] rounded-tl-[16px] rounded-tr-[6px] bg-[#2A2830] px-4 py-[14px]">
          <p className="text-[13px] font-normal leading-[23.4px] text-[#F7F5FB]">
            {message.text}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full items-start gap-[5px]">
      <img
        src={memoryChatAvatar}
        alt=""
        className="mt-0.5 h-[38.844px] w-[38.844px] shrink-0 rounded-full border border-[#E0DBE8] object-cover"
      />
      <div className="min-w-0">
        <div className="max-w-[264px] rounded-bl-[16px] rounded-br-[16px] rounded-tl-[6px] rounded-tr-[16px] border border-[#E0DBE8] bg-white px-[17px] py-[15px]">
          <p
            className={`font-serif text-[13px] font-normal leading-[23.4px] text-[#2A2830] ${
              message.result?.fallbackTriggered ? 'italic text-[#7A767F]' : ''
            }`}
          >
            {message.text}
          </p>
        </div>
        <EvidenceFooter
          message={message}
          memoryChunks={memoryChunks}
          expanded={expanded}
          onToggle={onToggleSource}
        />
      </div>
    </div>
  )
}

function LoadingBubble() {
  return (
    <div className="flex w-full items-start gap-[5px]">
      <img
        src={memoryChatAvatar}
        alt=""
        className="mt-0.5 h-[38.844px] w-[38.844px] shrink-0 rounded-full border border-[#E0DBE8] object-cover"
      />
      <div className="rounded-bl-[16px] rounded-br-[16px] rounded-tl-[6px] rounded-tr-[16px] border border-[#E0DBE8] bg-white px-[17px] py-[15px]">
        <div className="flex h-[23.4px] items-center gap-1.5">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1.5 w-1.5 rounded-full bg-[#9485BE] animate-bounce"
              style={{ animationDelay: `${index * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatbotScreen() {
  const navigate = useNavigate()
  const { transcripts, fetchTranscripts } = useInterviewStore()
  const { role, userId, userName } = useAuthStore()
  const isOfflineDemo = useDevModeStore((state) => state.isOfflineDemo)
  const { activeSenior, activeSeniorId, loading: activeSeniorLoading } = useActiveSeniorContext({
    enabled: role === 'child',
  })

  const [serverMemories, setServerMemories] = useState<Memory[]>([])
  const [messages, setMessages] = useState<Message[]>([createWelcomeMessage()])
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSources, setIsLoadingSources] = useState(false)
  const [sourceOwnerKey, setSourceOwnerKey] = useState<string | null>(null)
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const chatOwnerId = role === 'child' ? activeSeniorId : userId
  const chatOwnerKey = `${role ?? 'guest'}:${chatOwnerId || 'unselected'}`
  const hasActiveRecordScope = role !== 'child' || Boolean(activeSeniorId)

  useEffect(() => {
    if (role === 'child' && activeSeniorLoading) return
    if (role === 'child' && !activeSeniorId) {
      setServerMemories([])
      setSourceOwnerKey(null)
      setIsLoadingSources(false)
      return
    }

    if (isOfflineDemo) {
      setServerMemories([])
      setSourceOwnerKey(chatOwnerKey)
      setIsLoadingSources(false)
      return
    }

    let alive = true
    const targetSeniorId = role === 'child' ? activeSeniorId : undefined
    const ownerKey = chatOwnerKey

    setIsLoadingSources(true)
    setSourceOwnerKey(null)
    setServerMemories([])

    void (async () => {
      try {
        const [memoryResult] = await Promise.all([
          fetchLocalMemories(targetSeniorId).catch((error) => {
            console.error('fetchLocalMemories error:', error)
            // 서버에 못 닿았을 때 지난 대화를 지우면 통신 장애만으로 대화가 영영 사라진다.
            // 철회 반영은 다음 성공한 조회로 미룬다.
            return { memories: [], chatbotConsentUpdatedAt: null }
          }),
          fetchTranscripts(targetSeniorId),
        ])

        if (!alive) return
        setServerMemories(memoryResult.memories ?? [])
        setChatSessions(dropChatSessionsRevokedSince(ownerKey, memoryResult.chatbotConsentUpdatedAt))
        setSourceOwnerKey(ownerKey)
      } finally {
        if (alive) setIsLoadingSources(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [activeSeniorId, activeSeniorLoading, chatOwnerKey, fetchTranscripts, isOfflineDemo, role])

  useEffect(() => {
    const sessions = readChatSessions(chatOwnerKey)
    setChatSessions(sessions)
    setCurrentSessionId(null)
    setMessages([createWelcomeMessage()])
    setExpandedSourceId(null)
    setShowHistory(false)
  }, [chatOwnerKey])

  const memoryChunks = useMemo(
    () => {
      if (sourceOwnerKey !== chatOwnerKey) return []

      const chunksFromMemories = buildMemoryChunksFromMemories(serverMemories)
      const chunksFromTranscripts = buildMemoryChunksFromTranscripts(
        // 민감정보 미동의 기록은 외부 AI 호출에 넣지 않는다.
        transcripts.filter((transcript) => transcript.chatbot !== false && transcript.sensitive !== false)
      ).map((chunk) => ({
        ...chunk,
        reliabilityLabel: chunk.reliabilityLabel === 'UNVERIFIED'
          ? 'ESTIMATED' as const
          : chunk.reliabilityLabel,
      }))
      return mergeMemoryChunks(chunksFromTranscripts, chunksFromMemories)
    },
    [chatOwnerKey, serverMemories, sourceOwnerKey, transcripts]
  )

  const storyOwnerLabel = role === 'child' && activeSenior
    ? activeSenior.displayName
    : role === 'parent' && userName.trim()
    ? `${userName.trim()}님의 이야기`
    : '부모님의 이야기'

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages, isLoading, expandedSourceId])

  const persistSessionMessages = (sessionId: string, nextMessages: Message[]) => {
    if (!nextMessages.some((message) => message.role === 'user')) return

    const now = new Date().toISOString()
    const existingSession = chatSessions.find((session) => session.id === sessionId)
    const nextSession: ChatSession = {
      id: sessionId,
      createdAt: existingSession?.createdAt ?? now,
      updatedAt: now,
      ownerLabel: storyOwnerLabel,
      messages: nextMessages,
    }
    const nextSessions = [
      nextSession,
      ...chatSessions.filter((session) => session.id !== sessionId),
    ].slice(0, MAX_CHAT_SESSIONS)

    setChatSessions(nextSessions)
    writeChatSessions(chatOwnerKey, nextSessions)
  }

  const handleStartNewChat = () => {
    setMessages([createWelcomeMessage()])
    setCurrentSessionId(null)
    setExpandedSourceId(null)
    setShowHistory(false)
  }

  const handleLoadSession = (session: ChatSession) => {
    setMessages(session.messages.length > 0 ? session.messages : [createWelcomeMessage()])
    setCurrentSessionId(session.id)
    setExpandedSourceId(null)
    setShowHistory(false)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading || isLoadingSources || !hasActiveRecordScope) return

    const now = Date.now()
    const sessionId = currentSessionId ?? `chat_${now}`
    const userMsg: Message = { id: `u_${now}`, role: 'user', text }
    const messagesWithUser = [...messages, userMsg]

    if (!currentSessionId) setCurrentSessionId(sessionId)
    setMessages(messagesWithUser)
    persistSessionMessages(sessionId, messagesWithUser)
    setInput('')
    setIsLoading(true)
    setExpandedSourceId(null)

    try {
      const result = await generatePersonaResponse(text, memoryChunks, DEFAULT_TONE)
      const aiMsg: Message = {
        id: `a_${Date.now()}`,
        role: 'ai',
        text: result.responseText,
        result,
      }
      const nextMessages = [...messagesWithUser, aiMsg]
      setMessages(nextMessages)
      persistSessionMessages(sessionId, nextMessages)
    } catch {
      const errMsg: Message = {
        id: `e_${Date.now()}`,
        role: 'ai',
        text: '죄송해요, 지금은 답하기 어렵네요. 다시 여쭤봐 주세요.',
      }
      const nextMessages = [...messagesWithUser, errMsg]
      setMessages(nextMessages)
      persistSessionMessages(sessionId, nextMessages)
    } finally {
      setIsLoading(false)
    }
  }

  const inputDisabled = isLoading || isLoadingSources || !hasActiveRecordScope
  const inputPlaceholder = !hasActiveRecordScope
    ? '기록 공간을 먼저 선택해 주세요'
    : isLoadingSources
      ? '저장된 이야기를 불러오는 중입니다...'
      : '부모님의 이야기에 대해 물어보세요...'

  return (
    <div className="flex h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
      <header className="shrink-0 border-b border-[#E0DBE8]">
        <div className="flex items-center gap-3 px-6 pb-[17px] pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="-ml-1 flex h-9 items-center gap-1 rounded-full pr-2 text-[#7A767F] transition active:scale-95"
            aria-label="이전 화면으로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="text-[12px] font-medium leading-4 tracking-[0.3px]">뒤로</span>
          </button>
          <div className="min-w-0 pl-2">
            <h1 className="truncate font-serif text-[14px] font-semibold leading-[21px] text-[#2A2830]">
              기억 대화방
            </h1>
            <p className="mt-0.5 truncate text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
              {storyOwnerLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory((value) => !value)}
            className="ml-auto flex h-9 shrink-0 items-center gap-1 rounded-full border border-[#E0DBE8] bg-white px-3 text-[11px] font-medium leading-4 text-[#7A767F] transition active:scale-95"
            aria-label="이전 대화 보기"
            aria-expanded={showHistory}
          >
            <Clock3 className="h-3.5 w-3.5 text-[#9485BE]" aria-hidden="true" />
            이전 대화
          </button>
        </div>
      </header>

      <section className="shrink-0 border-b border-[#E0DBE8] px-5 pb-px pt-3">
        <p className="text-center text-[11px] font-normal leading-[18.7px] text-[#7A767F]">
          모든 내용은 실제 기록된 이야기에서 가져옵니다.
          <br />
          <span className="text-[#9485BE]/80">원문은 항상 그대로 보존됩니다.</span>
        </p>
      </section>

      {showHistory ? (
        <section className="shrink-0 border-b border-[#E0DBE8] bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold leading-[18px] text-[#2A2830]">이전 대화</p>
              <p className="mt-0.5 text-[10px] leading-[15px] text-[#7A767F]">
                {storyOwnerLabel} 기준으로 저장됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartNewChat}
              className="flex min-h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#2A2830] px-3 text-[11px] font-medium leading-4 text-[#F7F5FB] transition active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              새 대화
            </button>
          </div>

          {chatSessions.length === 0 ? (
            <p className="mt-3 rounded-[12px] bg-[#F8F6F9] px-4 py-3 text-[12px] leading-[18px] text-[#7A767F]">
              아직 저장된 대화가 없어요.
            </p>
          ) : (
            <div className="mt-3 flex max-h-[168px] flex-col gap-2 overflow-y-auto">
              {chatSessions.map((session) => {
                const active = currentSessionId === session.id
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => handleLoadSession(session)}
                    className={`rounded-[12px] border px-4 py-3 text-left transition active:scale-[0.99] ${
                      active
                        ? 'border-[#9485BE] bg-[#F1ECFA]'
                        : 'border-[#E0DBE8] bg-[#F8F6F9]'
                    }`}
                  >
                    <span className="block truncate text-[12px] font-semibold leading-[18px] text-[#2A2830]">
                      {getChatSessionTitle(session.messages)}
                    </span>
                    <span className="mt-1 block text-[10px] leading-[15px] text-[#7A767F]">
                      {formatChatSessionDate(session.updatedAt)} · 질문 {getChatSessionTurnCount(session.messages)}개
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
        <div className="flex flex-col gap-6">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              memoryChunks={memoryChunks}
              expanded={expandedSourceId === message.id}
              onToggleSource={() =>
                setExpandedSourceId((current) => (current === message.id ? null : message.id))
              }
            />
          ))}
          {isLoading ? <LoadingBubble /> : null}
          <div ref={bottomRef} />
        </div>
      </main>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void handleSend()
        }}
        className="shrink-0 border-t border-[#E0DBE8] px-5 pb-[22px] pt-[17px]"
      >
        <div className="flex h-[54px] items-center gap-3 rounded-[14px] border border-[#E0DBE8] bg-white px-[17px] py-[13px]">
          <input
            type="text"
            placeholder={inputPlaceholder}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[13px] font-normal text-[#2A2830] outline-none placeholder:text-[#7A767F]/50"
            disabled={inputDisabled}
          />
          <button
            type="submit"
            disabled={!input.trim() || inputDisabled}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2A2830] text-[#F7F5FB] transition active:scale-95 disabled:bg-[#CFC8DA]"
            aria-label="질문 보내기"
          >
            <SendHorizontal className="h-[13px] w-[13px]" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-3 text-center text-[10px] font-normal leading-[15px] tracking-[0.25px] text-[#7A767F]/60">
          답변은 저장된 이야기의 원문을 바탕으로 구성됩니다
        </p>
      </form>
    </div>
  )
}
