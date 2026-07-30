import { useState, useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft, Camera, CheckCircle2, Loader2, MapPin, ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ActiveSeniorContextBar, MissingSeniorState } from '../components/ActiveSeniorContextBar'
import ChildBottomNav from '../components/ChildBottomNav'
import { useActiveSeniorContext } from '../hooks/useActiveSeniorContext'
import { useChildStore } from '../store/childStore'
import { uploadLocalPhoto, type PhotoUploadMetadata } from '../lib/local-server'
import {
  GPS_MASK_LABEL,
  buildMaskedLocationText,
  isGpsMaskedLocationText,
  sanitizePhotoForUpload,
} from '../lib/photos/metadata'
import type { DemoPhoto } from '../types/child'
import photoUploadMascot from '../assets/figma/photo-upload-mascot.png'

const PALETTE_COLORS = ['#EDE8F0', '#EEE9F2', '#EDE8F0', '#F3EFF5']

function MetadataField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase leading-[16.5px] tracking-[1.65px] text-[#7A767F]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-[47px] w-full rounded-[10px] border border-[#E0DBE8] bg-white px-4 text-[14px] text-[#2A2830] outline-none transition placeholder:text-[#7A767F]/50 focus:border-[#9485BE] focus:ring-4 focus:ring-[#9485BE]/10"
      />
    </label>
  )
}

function GpsMaskNotice() {
  return (
    <div className="flex items-start gap-2 rounded-[14px] border border-[#E0DBE8] bg-white px-4 py-3">
      <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#9485BE]" aria-hidden="true" />
      <p className="text-[12px] font-normal leading-[18px] text-[#7A767F]">
        사진에 위치 정보(GPS)가 있으면 원본 좌표는 저장하지 않고 <span className="text-[#2A2830]">{GPS_MASK_LABEL}</span>로 표시해요.
      </p>
    </div>
  )
}

function GpsMaskedBadge() {
  return (
    <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-[#EEE9F2] px-2.5 py-1.5">
      <MapPin className="h-3.5 w-3.5 text-[#9485BE]" aria-hidden="true" />
      <span className="text-[12px] font-medium text-[#7A767F]">위치 정보 {GPS_MASK_LABEL}</span>
    </div>
  )
}

function isPhotoGpsMasked(photo: DemoPhoto): boolean {
  return photo.metadata?.gpsMasked === true || isGpsMaskedLocationText(photo.metadata?.location)
}

function PhotoQuestionUploadScreen({
  contextBar,
  error,
  loading,
  onBack,
  onUpload,
}: {
  contextBar?: ReactNode
  error?: string | null
  loading: boolean
  onBack: () => void
  onUpload: (files: File[], metadata: PhotoUploadMetadata) => Promise<void>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [capturedDate, setCapturedDate] = useState('')
  const [locationText, setLocationText] = useState('')
  const [memo, setMemo] = useState('')
  const [linkedQuestion, setLinkedQuestion] = useState('')

  const selectedSummary = selectedFiles.length === 0
    ? null
    : selectedFiles.length === 1
      ? selectedFiles[0].name
      : `${selectedFiles.length}장 선택됨`

  const handleSelectedFiles = (files: FileList | null) => {
    setSelectedFiles(Array.from(files ?? []).slice(0, 10))
  }

  const submit = async () => {
    if (selectedFiles.length === 0) {
      fileInputRef.current?.click()
      return
    }
    await onUpload(selectedFiles, {
      capturedDate: capturedDate.trim(),
      location: locationText.trim(),
      memo: memo.trim(),
      linkedQuestion: linkedQuestion.trim(),
    })
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[390px] flex-col overflow-hidden rounded-b-[28px] bg-[#F8F6F9] text-[#2A2830]">
      <input
        ref={fileInputRef}
        aria-label="사진 파일 선택"
        type="file"
        accept="image/jpeg,image/png,image/*"
        multiple
        onChange={(event) => handleSelectedFiles(event.target.files)}
        className="hidden"
      />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-[118px] pt-2">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[#7A767F] transition active:scale-95"
          aria-label="질문 만들기 방식으로 돌아가기"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <header className="relative mt-5">
          <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
            사진 업로드
          </p>
          <h1 className="mt-4 font-serif text-[26px] font-normal leading-[39px] text-[#2A2830]">
            사진으로 기억을
            <br />
            열어보세요
          </h1>
          <img
            src={photoUploadMascot}
            alt=""
            className="absolute right-4 top-[62px] h-[73px] w-[65px] object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
          />
        </header>

        {contextBar ? <div className="mt-6">{contextBar}</div> : null}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="mt-6 flex h-[188px] w-full flex-col items-center justify-center rounded-[14px] border border-dashed border-[#E0DBE8] bg-white px-5 text-center transition active:scale-[0.99] disabled:cursor-wait"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDE8F0] text-[#7A767F]">
            {selectedSummary ? (
              <CheckCircle2 className="h-5 w-5 text-[#9485BE]" aria-hidden="true" />
            ) : (
              <Camera className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <span className="mt-3 block max-w-full truncate text-[13px] font-medium leading-[19.5px] text-[#2A2830]">
            {selectedSummary || '사진을 선택해주세요'}
          </span>
          <span className="mt-2 text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
            JPG, PNG · 최대 10장
          </span>
        </button>

        <div className="mt-7 space-y-[22px]">
          {error ? (
            <div className="rounded-[14px] border border-[#B03A2E]/20 bg-[#B03A2E]/10 px-4 py-3 text-[13px] font-medium leading-[19.5px] text-[#B03A2E]">
              {error}
            </div>
          ) : null}
          <MetadataField
            label="날짜"
            value={capturedDate}
            placeholder="예: 1985년 봄"
            onChange={setCapturedDate}
          />
          <MetadataField
            label="장소"
            value={locationText}
            placeholder="예: 외할머니 댁 마당"
            onChange={setLocationText}
          />
          <GpsMaskNotice />
          <MetadataField
            label="사진 메모"
            value={memo}
            placeholder="이 사진에 대해 기억하는 것을 적어보세요"
            onChange={setMemo}
          />
          <MetadataField
            label="연결할 질문"
            value={linkedQuestion}
            placeholder='예: "이 사진은 언제 찍은 사진인가요?"'
            onChange={setLinkedQuestion}
          />
        </div>
      </main>

      <footer className="fixed bottom-0 left-1/2 z-40 w-full max-w-[390px] -translate-x-1/2 bg-[#F8F6F9]/95 px-6 pb-[calc(env(safe-area-inset-bottom)+37px)] pt-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading}
          className="flex min-h-[51px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2A2830] px-5 text-center text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99] disabled:cursor-wait disabled:bg-[#7A767F]"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
          {loading ? '사진을 올리고 있어요...' : '사진 올리기'}
        </button>
      </footer>
    </div>
  )
}

function PhotoPlaceholder({ url, index }: { url?: string; index: number }) {
  if (url) {
    return (
      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden relative">
        <img src={url} alt="Uploaded old photo" className="w-full h-full object-cover" />
      </div>
    )
  }
  const bg = PALETTE_COLORS[index % PALETTE_COLORS.length]
  return (
    <div
      className="w-full aspect-[4/3] rounded-xl flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: bg }}
    >
      {/* Decorative old-photo elements */}
      <div className="absolute inset-0 opacity-20"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(42,40,48,0.3) 100%)' }} />
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.4">
        <circle cx="24" cy="18" r="8" fill="#2A2830" />
        <path d="M8 42C8 32 40 32 40 42" fill="#2A2830" />
        <circle cx="14" cy="28" r="5" fill="#2A2830" />
        <path d="M4 42C4 35 24 35 24 42" fill="#2A2830" />
      </svg>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative w-16 h-16">
        <div
          className="absolute inset-0 rounded-full border-4 border-t-[#9485BE] animate-spin"
          style={{ borderColor: '#E0DBE8 #E0DBE8 #E0DBE8 #9485BE' }}
        />
      </div>
      <div className="text-center">
        <p className="text-[16px] font-medium text-[#2A2830]">AI가 사진을 분석하고 있어요</p>
        <p className="text-[14px] text-[#7A767F] mt-1">어울리는 질문을 생성 중입니다...</p>
      </div>
    </div>
  )
}

function PhotoCard({
  photo,
  index,
  onAddQuestion,
  addedQuestions,
}: {
  photo: DemoPhoto
  index: number
  onAddQuestion: (text: string) => void
  addedQuestions: Set<string>
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
    >
      <PhotoPlaceholder url={photo.url} index={index} />
      <div className="p-4">
        {isPhotoGpsMasked(photo) ? <GpsMaskedBadge /> : null}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[15px] font-bold text-[#2A2830]">{photo.caption}</p>
            <p className="text-[12px] text-[#7A767F] mt-0.5">{photo.addedAt} 추가</p>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[13px] text-[#9485BE]"
          >
            {expanded ? '접기' : `질문 ${photo.generatedQuestions.length}개`}
          </button>
        </div>

        {expanded && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#2A2830" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M2 17L12 22L22 17" stroke="#2A2830" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="#2A2830" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              <p className="text-[12px] font-medium text-[#2A2830]">AI가 생성한 질문</p>
            </div>
            <div className="flex flex-col gap-2">
              {photo.generatedQuestions.map((q) => {
                const isAdded = addedQuestions.has(q) || (photo.registeredQuestions || []).includes(q)
                return (
                  <div
                    key={q}
                    className="rounded-xl px-4 py-3 flex items-start gap-3"
                    style={{ backgroundColor: isAdded ? '#EEE9F2' : '#F8F6F9' }}
                  >
                    <p className="flex-1 text-[14px] text-[#2A2830] leading-relaxed">{q}</p>
                    <button
                      onClick={() => !isAdded && onAddQuestion(q)}
                      disabled={isAdded}
                      className="flex-shrink-0 min-h-[32px] px-3 rounded-lg text-[12px] font-medium transition-all"
                      style={{
                        backgroundColor: isAdded ? 'transparent' : '#9485BE',
                        color: isAdded ? '#9485BE' : 'white',
                      }}
                    >
                      {isAdded ? '✓ 등록됨' : '등록'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChildPhotosScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const { photos, fetchPhotos, addPhoto, markQuestionAsAddedFromPhoto } = useChildStore()
  const incomingSeniorId = (location.state as { seniorId?: string | null } | null)?.seniorId ?? null
  const {
    activeSenior,
    activeSeniorId,
    loading: seniorLoading,
    seniors,
    setActiveSeniorId,
  } = useActiveSeniorContext({ preferredSeniorId: incomingSeniorId })
  const [loading, setLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [addedQuestions, setAddedQuestions] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fromQuestions = (location.state as { fromQuestions?: boolean } | null)?.fromQuestions === true

  useEffect(() => {
    if (activeSeniorId) fetchPhotos()
  }, [activeSeniorId, fetchPhotos])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const uploadFiles = async (files: File[], metadata: PhotoUploadMetadata = {}) => {
    const targetFiles = files.slice(0, 10)
    if (!activeSeniorId || targetFiles.length === 0) return false

    setLoading(true)
    setUploadError(null)
    try {
      for (const file of targetFiles) {
        // 원본 GPS 좌표는 서버로 보내지 않는다. 파일의 EXIF 를 제거하고
        // 좌표가 있던 사진은 `공개 전 확인 필요` 문구로 대체한다.
        const sanitized = await sanitizePhotoForUpload(file)
        const uploadMetadata: PhotoUploadMetadata = sanitized.gpsMasked
          ? { ...metadata, location: buildMaskedLocationText(metadata.location, true) }
          : metadata

        const res = await uploadLocalPhoto(sanitized.file, 'childhood', uploadMetadata)
        const photoObj = res.photo as any
        const photoMetadata = {
          ...(photoObj.metadata || uploadMetadata),
          ...(sanitized.gpsMasked
            ? { gpsMasked: true, locationLabel: GPS_MASK_LABEL }
            : {}),
        }
        const gQuestions = res.questions
          .map((q: any) => q.questionText || q.text)
          .filter(Boolean)

        addPhoto({
          id: photoObj.id,
          caption: photoMetadata.memo || photoObj.fileName || file.name,
          url: photoObj.url,
          metadata: photoMetadata,
          generatedQuestions: gQuestions,
          registeredQuestions: photoObj.registeredQuestions || [],
        })
      }
      return true
    } catch (err) {
      console.error(err)
      setUploadError('사진 업로드에 실패했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.')
      return false
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void uploadFiles(Array.from(e.target.files ?? []))
  }

  const handleAddQuestion = (photoId: string, questionText: string) => {
    if (!activeSeniorId) return
    markQuestionAsAddedFromPhoto(photoId, questionText, activeSeniorId)
    setAddedQuestions((prev) => new Set([...prev, questionText]))
  }

  const contextBar = (
    <ActiveSeniorContextBar
      activeSenior={activeSenior}
      activeSeniorId={activeSeniorId}
      loading={seniorLoading}
      onChange={setActiveSeniorId}
      seniors={seniors}
    />
  )

  if (!seniorLoading && !activeSenior) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
        <MissingSeniorState onCreate={() => navigate('/child/record-space/new')} />
        <ChildBottomNav />
      </div>
    )
  }

  if (fromQuestions) {
    return (
      <PhotoQuestionUploadScreen
        contextBar={contextBar}
        error={uploadError}
        loading={loading}
        onBack={() => navigate(-1)}
        onUpload={async (files, metadata) => {
          const uploaded = await uploadFiles(files, metadata)
          if (uploaded) navigate('/child/photos', { replace: true })
        }}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F6F9]">
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* Header */}
        <div className="px-5 pt-14 pb-5">
          <h1 className="text-[22px] font-bold text-[#2A2830]">사진 올리기</h1>
          <p className="mt-0.5 text-[16px] text-[#7A767F]">사진을 올리면 AI가 질문을 만들어드려요</p>
        </div>

        {/* How it works banner */}
        <div className="mx-5 mb-5 rounded-xl px-4 py-3" style={{ backgroundColor: '#EDE8F0' }}>
          <p className="text-[13px] text-[#2A2830] leading-relaxed">
            오래된 가족 사진을 올리면 AI가 사진 속 이야기를 이끌어낼 질문을 자동으로 생성합니다.
            마음에 드는 질문을 선택해 인터뷰에 등록하세요.
          </p>
        </div>

        <div className="mx-5 mb-5">
          <GpsMaskNotice />
        </div>

        <div className="px-5">
          <div className="mb-5">{contextBar}</div>
          {uploadError ? (
            <div className="mb-5 rounded-[14px] border border-[#B03A2E]/20 bg-[#B03A2E]/10 px-4 py-3 text-[13px] font-medium leading-[19.5px] text-[#B03A2E]">
              {uploadError}
            </div>
          ) : null}

          {loading ? (
            <LoadingState />
          ) : (
            <>
              {/* Upload button */}
              <button
                onClick={handleUploadClick}
                className="w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-8 mb-5 transition-opacity active:opacity-70 cursor-pointer"
                style={{ borderColor: '#9485BE', backgroundColor: '#FFFFFF' }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#F3EFF5' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="5" width="20" height="15" rx="2" stroke="#9485BE" strokeWidth="1.8" />
                    <circle cx="8.5" cy="10.5" r="1.5" stroke="#9485BE" strokeWidth="1.8" />
                    <path d="M2 17L7 11L11 15L15 10L22 17" stroke="#9485BE" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M17 2V8M14 5H20" stroke="#9485BE" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-medium text-[#2A2830]">사진 추가하기</p>
                  <p className="text-[13px] text-[#7A767F] mt-0.5">탭하면 기기의 오래된 사진을 올리고 AI 분석을 합니다</p>
                </div>
              </button>

              {/* Photo cards */}
              {photos.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[15px] text-[#7A767F]">아직 추가된 사진이 없어요</p>
                  <p className="text-[13px] text-[#7A767F] mt-1">위 버튼으로 사진을 추가해 보세요</p>
                </div>
              ) : (
                [...photos].reverse().map((photo, i) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    index={i}
                    onAddQuestion={(q) => handleAddQuestion(photo.id, q)}
                    addedQuestions={addedQuestions}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>

      <ChildBottomNav />
    </div>
  )
}
