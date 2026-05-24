import { useState, useRef, useMemo } from 'react'
import ChildBottomNav from '../components/ChildBottomNav'
import { useStore } from '../store'
import { uploadLocalPhoto, createLocalQuestion } from '../lib/local-server'

const PALETTE_COLORS = ['#F2D9B8', '#D9E0D2', '#EBC7A6', '#F4DDD0']

function PhotoPlaceholder({ index, url }: { index: number; url?: string }) {
  const bg = PALETTE_COLORS[index % PALETTE_COLORS.length]
  if (url) {
    return (
      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden relative">
        <img src={url} alt="Uploaded" className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div
      className="w-full aspect-[4/3] rounded-xl flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: bg }}
    >
      <div className="absolute inset-0 opacity-20"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(62,49,40,0.3) 100%)' }} />
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.4">
        <circle cx="24" cy="18" r="8" fill="#8B5E3C" />
        <path d="M8 42C8 32 40 32 40 42" fill="#8B5E3C" />
        <circle cx="14" cy="28" r="5" fill="#6F4A30" />
        <path d="M4 42C4 35 24 35 24 42" fill="#6F4A30" />
      </svg>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 animate-pulse">
      <div className="relative w-16 h-16">
        <div
          className="absolute inset-0 rounded-full border-4 border-t-[#C8956C] animate-spin"
          style={{ borderColor: '#E7DED2 #E7DED2 #E7DED2 #C8956C' }}
        />
      </div>
      <div className="text-center">
        <p className="text-[16px] font-medium text-[#3E3128]">AI가 사진을 분석하고 있어요</p>
        <p className="text-[14px] text-[#7A6A5C] mt-1">어울리는 회상 질문을 생성 중입니다...</p>
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
  photo: any
  index: number
  onAddQuestion: (text: string) => void
  addedQuestions: Set<string>
}) {
  const [expanded, setExpanded] = useState(true)
  const questions = photo.generatedQuestions || []

  return (
    <div
      className="rounded-2xl overflow-hidden mb-4 animate-fade-in"
      style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 12px rgba(139,94,60,0.08)' }}
    >
      <PhotoPlaceholder index={index} url={photo.url} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[15px] font-bold text-[#3E3128]">{photo.caption}</p>
            <p className="text-[12px] text-[#7A6A5C] mt-0.5">
              {new Date(photo.uploadedAt).toLocaleDateString('ko-KR')} 추가됨
            </p>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[13px] text-[#C8956C] focus:outline-none"
          >
            {expanded ? '접기' : `질문 ${questions.length}개`}
          </button>
        </div>

        {expanded && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#8B5E3C" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M2 17L12 22L22 17" stroke="#8B5E3C" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="#8B5E3C" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              <p className="text-[12px] font-medium text-[#8B5E3C]">AI 단서 질문</p>
            </div>
            <div className="flex flex-col gap-2">
              {questions.length > 0 ? (
                questions.map((q: string) => {
                  const isAdded = addedQuestions.has(q)
                  return (
                    <div
                      key={q}
                      className="rounded-xl px-4 py-3 flex items-start gap-3"
                      style={{ backgroundColor: isAdded ? '#D9E0D2' : '#F8F3EA' }}
                    >
                      <p className="flex-1 text-[14px] text-[#3E3128] leading-relaxed">{q}</p>
                      <button
                        onClick={() => !isAdded && onAddQuestion(q)}
                        disabled={isAdded}
                        className="flex-shrink-0 min-h-[32px] px-3 rounded-lg text-[12px] font-medium transition-all focus:outline-none disabled:opacity-80"
                        style={{
                          backgroundColor: isAdded ? 'transparent' : '#C8956C',
                          color: isAdded ? '#6B8F71' : 'white',
                        }}
                      >
                        {isAdded ? '✓ 등록됨' : '등록'}
                      </button>
                    </div>
                  )
                })
              ) : (
                <p className="text-[13px] text-[#7A6A5C] py-2 text-center">생성된 질문이 없습니다.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChildPhotosScreen() {
  const storePhotos = useStore((state) => state.photos.photos)
  const addStorePhoto = useStore((state) => state.addPhoto)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [addedQuestions, setAddedQuestions] = useState<Set<string>>(new Set())

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      // 1. Upload photo and get AI analysis results
      const res = await uploadLocalPhoto(file, 'photos')
      const photoObj = res.photo as any
      
      // Resolve file key url to render it
      const API_BASE = import.meta.env.VITE_LOCAL_API_URL ?? 'http://localhost:8787'
      const photoUrl = `${API_BASE}/api/files/${photoObj.fileKey}`

      // 2. Parse AI questions
      const generatedQuestions = res.questions.map((q: any) => q.text)

      // 3. Add to Zustand store to persist
      addStorePhoto({
        id: photoObj.id,
        url: photoUrl,
        uploadedAt: new Date().toISOString(),
        analysis: JSON.parse(photoObj.analysisJson || '{}'),
        linkedMemoryIds: [],
        generatedQuestions // custom field for UI rendering
      } as any)

    } catch (err) {
      console.error(err)
      alert("사진 업로드 및 AI 분석에 실패했습니다. 서버 상태를 확인해 주세요.")
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAddQuestion = async (questionText: string) => {
    try {
      await createLocalQuestion(questionText)
      setAddedQuestions((prev) => new Set([...prev, questionText]))
    } catch (e) {
      console.error(e)
      alert("인터뷰 질문 등록에 실패했습니다.")
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F3EA]">
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
          <h1 className="text-[22px] font-bold text-[#3E3128]">사진 올리기</h1>
          <p className="mt-0.5 text-[16px] text-[#7A6A5C]">사진을 올리면 AI가 질문을 만들어드려요</p>
        </div>

        {/* How it works banner */}
        <div className="mx-5 mb-5 rounded-xl px-4 py-3" style={{ backgroundColor: '#EBC7A6' }}>
          <p className="text-[13px] text-[#6F4A30] leading-relaxed">
            오래된 가족 사진을 올리면 AI가 사진 속 인물, 장소, 사물을 인식하고 이야기를 이끌어낼 질문을 자동으로 생성합니다.
            마음에 드는 질문을 선택해 부모님의 인터뷰 질문에 등록하세요.
          </p>
        </div>

        <div className="px-5">
          {loading ? (
            <LoadingState />
          ) : (
            <>
              {/* Upload button */}
              <button
                onClick={handleUploadClick}
                className="w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-8 mb-5 transition-all active:opacity-75 focus:outline-none cursor-pointer"
                style={{ borderColor: '#C8956C', backgroundColor: '#FFFDF8' }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#F4DDD0' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="5" width="20" height="15" rx="2" stroke="#C8956C" strokeWidth="1.8" />
                    <circle cx="8.5" cy="10.5" r="1.5" stroke="#C8956C" strokeWidth="1.8" />
                    <path d="M2 17L7 11L11 15L15 10L22 17" stroke="#C8956C" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M17 2V8M14 5H20" stroke="#C8956C" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-medium text-[#8B5E3C]">사진 추가하기</p>
                  <p className="text-[13px] text-[#7A6A5C] mt-0.5">탭하여 기기의 사진을 선택하세요</p>
                </div>
              </button>

              {/* Photo cards */}
              {storePhotos.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[15px] text-[#7A6A5C]">아직 추가된 사진이 없어요</p>
                  <p className="text-[13px] text-[#7A6A5C] mt-1">위 버튼으로 사진을 추가해 보세요</p>
                </div>
              ) : (
                [...storePhotos].reverse().map((photo, i) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    index={i}
                    onAddQuestion={handleAddQuestion}
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
