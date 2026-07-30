import { useCallback, useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import {
  fetchLocalPublicationPreviewJob,
  startLocalPublicationPreviewJob,
  type LocalPublicationEditorialPlan,
  type LocalPublicationPreviewJob,
  type LocalPublicationPreviewResponse,
  type LocalPublicationToneProfile,
  type LocalPublicationWritingDraft,
} from '../lib/local-server'

type RequestRole = 'senior' | 'guardian'

export type PublicationPreviewState = {
  editorialPlan: LocalPublicationEditorialPlan | null
  error: string | null
  html: string
  isStale: boolean
  job: LocalPublicationPreviewJob | null
  loading: boolean
  previewUrl: string
  refresh: () => Promise<void>
  statusMessage: string
  update: () => Promise<void>
  writingDraft: LocalPublicationWritingDraft | null
}

const stageMessages: Record<string, string> = {
  cache_check: '기록집 자료를 확인하고 있어요...',
  editorial_plan: '기록집 작성 에이전트가 책의 흐름을 설계하고 있어요...',
  writing_draft: '기록집 작성 에이전트가 글을 쓰고 있어요...',
  manifest: '기록집 작성 에이전트가 최종 구성을 다듬고 있어요...',
  render: '기록집 미리보기를 펼치고 있어요...',
  done: '기록집 미리보기를 준비했어요.',
}

function userFacingPreviewError(message?: string | null) {
  const text = message?.trim()
  if (!text) return '기록집 작성 에이전트가 글을 완성하지 못했어요. 다시 작성해 주세요.'
  if (text.includes('empty content')) {
    return '기록집 작성 에이전트 응답이 비어 있어 다시 작성이 필요해요.'
  }
  if (text.startsWith('Publication ') || text.includes('agent returned') || text.includes('agent response')) {
    return '기록집 작성 에이전트가 결과물을 완성하지 못했어요. 다시 작성해 주세요.'
  }
  return text
}

function messageForJob(job: LocalPublicationPreviewJob | null) {
  if (!job) return '기록집 작성 에이전트가 글을 쓸 준비를 하고 있어요...'
  if (job.status === 'failed') return userFacingPreviewError(job.errorMessage)
  if (job.errorCode) return '기록집 작성 에이전트가 응답을 다시 기다리고 있어요...'
  return stageMessages[job.stage] ?? '기록집 작성 에이전트가 글을 쓰고 있어요...'
}

export function usePublicationPreview(
  seniorId?: string | null,
  refreshKey = 0,
  role: RequestRole = 'guardian',
  toneProfile?: LocalPublicationToneProfile | null,
): PublicationPreviewState {
  const [html, setHtml] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [editorialPlan, setEditorialPlan] = useState<LocalPublicationEditorialPlan | null>(null)
  const [writingDraft, setWritingDraft] = useState<LocalPublicationWritingDraft | null>(null)
  const [job, setJob] = useState<LocalPublicationPreviewJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)

  const applyResult = useCallback((result: LocalPublicationPreviewResponse) => {
    const nextJob = result.job ?? null
    setJob(nextJob)
    if (nextJob?.status === 'failed') {
      setError(userFacingPreviewError(nextJob.errorMessage))
      setLoading(false)
      return
    }

    if (result.html) {
      setHtml(result.html)
      setEditorialPlan(result.editorialPlan ?? null)
      setWritingDraft(result.writingDraft ?? null)
      setIsStale(Boolean(nextJob?.isStale))
      setError(null)
      setLoading(false)
      return
    }

    setError(null)
    setLoading(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setJob(null)
    setHtml('')
    setEditorialPlan(null)
    setWritingDraft(null)
    setIsStale(false)
    try {
      const result = await startLocalPublicationPreviewJob('A5', seniorId, role, toneProfile)
      applyResult(result)
    } catch (err) {
      console.error('Publication preview failed:', err)
      setHtml('')
      setEditorialPlan(null)
      setWritingDraft(null)
      setError(userFacingPreviewError(err instanceof Error ? err.message : '미리보기를 불러오지 못했어요'))
      setLoading(false)
    }
  }, [applyResult, role, seniorId, toneProfile])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setJob(null)
    try {
      const result = await startLocalPublicationPreviewJob('A5', seniorId, role, toneProfile, { forceRefresh: true })
      applyResult(result)
    } catch (err) {
      console.error('Publication preview failed:', err)
      setError(userFacingPreviewError(err instanceof Error ? err.message : '미리보기를 불러오지 못했어요'))
      setLoading(false)
    }
  }, [applyResult, role, seniorId, toneProfile])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  useEffect(() => {
    if (!job || job.status === 'ready' || job.status === 'failed') return undefined
    let cancelled = false
    const poll = async () => {
      try {
        const result = await fetchLocalPublicationPreviewJob(job.id, role)
        if (!cancelled) applyResult(result)
      } catch (err) {
        console.error('Publication preview polling failed:', err)
        if (!cancelled) {
          setError(userFacingPreviewError(err instanceof Error ? err.message : '미리보기 작성 상태를 불러오지 못했어요'))
          setLoading(false)
        }
      }
    }
    const timer = window.setInterval(() => {
      void poll()
    }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [applyResult, job, role])

  useEffect(() => {
    if (!html) {
      setPreviewUrl('')
      return
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setPreviewUrl('')
      return
    }

    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [html])

  return {
    editorialPlan,
    error,
    html,
    isStale,
    job,
    loading,
    previewUrl,
    refresh,
    statusMessage: messageForJob(job),
    update: refresh,
    writingDraft,
  }
}

export function PublicationBookFrame({
  className = 'relative h-full min-h-0 flex-1 overflow-hidden bg-[#E6E0D8]',
  error,
  html,
  loading,
  previewUrl,
  statusMessage,
  isStale,
  onRetry,
  onUpdate,
}: {
  className?: string
  error: string | null
  html: string
  isStale?: boolean
  loading: boolean
  previewUrl: string
  statusMessage?: string
  onRetry?: () => void
  onUpdate?: () => void
}) {
  const hasPreview = Boolean(html)
  return (
    <div className={className}>
      {hasPreview ? (
        <>
          <iframe
            title="기록집 미리보기"
            src={previewUrl || undefined}
            srcDoc={previewUrl ? undefined : html}
            className="absolute inset-0 block h-full min-h-0 w-full max-w-full border-0 bg-[#E6E0D8]"
            style={{ position: 'absolute', inset: 0, height: '100%', minHeight: 0, width: '100%' }}
            sandbox=""
          />
          {loading ? (
            <div className="absolute inset-x-4 top-4 rounded-full border border-[#DED7E6] bg-white/95 px-4 py-2 text-center text-[12px] font-medium text-[#5E5967] shadow-[0_8px_24px_rgba(42,40,48,0.10)]">
              {statusMessage ?? '기록집 작성 에이전트가 글을 쓰고 있어요...'}
            </div>
          ) : error ? (
            <div className="absolute inset-x-4 top-4 rounded-full border border-[#F1C7C7] bg-white/95 px-4 py-2 text-center text-[12px] font-medium text-[#C94A4A] shadow-[0_8px_24px_rgba(42,40,48,0.10)]">
              {error}
            </div>
          ) : isStale && onUpdate ? (
            <button
              type="button"
              onClick={onUpdate}
              className="absolute right-4 top-4 inline-flex h-10 items-center gap-2 rounded-full border border-[#DAD4E2] bg-white/95 px-4 text-[13px] font-semibold text-[#4E465B] shadow-[0_8px_24px_rgba(42,40,48,0.12)] transition active:scale-95"
            >
              <RotateCw className="h-4 w-4 text-[#9485BE]" aria-hidden="true" />
              업데이트하기
            </button>
          ) : null}
        </>
      ) : loading ? (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px] font-medium text-[#7A767F]">
          {statusMessage ?? '기록집 작성 에이전트가 글을 쓰고 있어요...'}
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
          <div className="flex max-w-[260px] flex-col items-center gap-4">
            <p className="text-[13px] font-medium leading-5 text-[#C94A4A]">{error}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[#DAD4E2] bg-white px-4 text-[13px] font-semibold text-[#4E465B] shadow-[0_8px_20px_rgba(42,40,48,0.08)] transition active:scale-95"
              >
                <RotateCw className="h-4 w-4 text-[#9485BE]" aria-hidden="true" />
                다시 작성하기
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function PublicationBookPreview({
  className,
  refreshKey,
  role = 'guardian',
  seniorId,
  toneProfile,
}: {
  className?: string
  refreshKey?: number
  role?: RequestRole
  seniorId?: string | null
  toneProfile?: LocalPublicationToneProfile | null
}) {
  const preview = usePublicationPreview(seniorId, refreshKey, role, toneProfile)

  return (
    <PublicationBookFrame
      className={className}
      error={preview.error}
      html={preview.html}
      isStale={preview.isStale}
      loading={preview.loading}
      previewUrl={preview.previewUrl}
      statusMessage={preview.statusMessage}
      onRetry={() => void preview.refresh()}
      onUpdate={() => void preview.update()}
    />
  )
}
