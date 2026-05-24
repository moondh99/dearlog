import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'

function Slide1Icon() {
  return (
    <div className="w-[128px] h-[128px] rounded-full bg-[#F2D9B8] flex items-center justify-center">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
        {/* Adult */}
        <circle cx="24" cy="22" r="10" fill="#EBC7A6" />
        <path d="M10 52C10 42 38 42 38 52" fill="#C8956C" opacity="0.7" />
        {/* Child */}
        <circle cx="50" cy="26" r="8" fill="#F4DDD0" />
        <path d="M38 52C38 44 62 44 62 52" fill="#EBC7A6" />
        {/* Heart */}
        <path d="M37 36C37 33.5 34.2 32 32 34C31.5 34.5 31 35.2 31 35.2C31 35.2 30.5 34.5 30 34C27.8 32 25 33.5 25 36C25 39.5 31 43 31 43C31 43 37 39.5 37 36Z" fill="#C8956C" />
      </svg>
    </div>
  )
}

function Slide2Icon() {
  return (
    <div className="w-[128px] h-[128px] rounded-full bg-[#D9E0D2] flex items-center justify-center">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
        {/* Center glow */}
        <circle cx="36" cy="36" r="12" fill="#8B5E3C" opacity="0.15" />
        <circle cx="36" cy="36" r="8" fill="#8B5E3C" opacity="0.8" />
        <circle cx="36" cy="36" r="4" fill="#EBC7A6" />
        {/* Rays */}
        <line x1="36" y1="10" x2="36" y2="22" stroke="#6B8F71" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="36" y1="50" x2="36" y2="62" stroke="#6B8F71" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="36" x2="22" y2="36" stroke="#6B8F71" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="50" y1="36" x2="62" y2="36" stroke="#6B8F71" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="18" y1="18" x2="26" y2="26" stroke="#6B8F71" strokeWidth="2" strokeLinecap="round" />
        <line x1="46" y1="46" x2="54" y2="54" stroke="#6B8F71" strokeWidth="2" strokeLinecap="round" />
        <line x1="54" y1="18" x2="46" y2="26" stroke="#6B8F71" strokeWidth="2" strokeLinecap="round" />
        <line x1="26" y1="46" x2="18" y2="54" stroke="#6B8F71" strokeWidth="2" strokeLinecap="round" />
        {/* Sparkles */}
        <circle cx="14" cy="14" r="3" fill="#C8956C" opacity="0.5" />
        <circle cx="58" cy="58" r="3" fill="#C8956C" opacity="0.5" />
      </svg>
    </div>
  )
}

function Slide3Icon() {
  return (
    <div className="w-[128px] h-[128px] rounded-full bg-[#F4DDD0] flex items-center justify-center">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
        {/* Book */}
        <path d="M8 18C8 15.8 9.8 14 12 14H34V54H12C9.8 54 8 52.2 8 50V18Z" fill="#EBC7A6" />
        <path d="M64 18C64 15.8 62.2 14 60 14H38V54H60C62.2 54 64 52.2 64 50V18Z" fill="#FFFDF8" />
        <rect x="33" y="12" width="6" height="44" rx="3" fill="#8B5E3C" />
        {/* Chat bubble */}
        <rect x="40" y="36" width="22" height="16" rx="4" fill="#C8956C" />
        <path d="M46 52L42 58L50 52" fill="#C8956C" />
        <line x1="44" y1="42" x2="58" y2="42" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="44" y1="47" x2="54" y2="47" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

const slides = [
  {
    Icon: Slide1Icon,
    title: '가족의 이야기를\n보존하세요',
    desc: '소중한 기억과 경험을\n그대로 담아드립니다',
  },
  {
    Icon: Slide2Icon,
    title: 'AI가 구조화,\n원문은 그대로',
    desc: '말씀하신 내용 그대로 보존하며\nAI가 읽기 좋게 정리합니다',
  },
  {
    Icon: Slide3Icon,
    title: '자서전으로, 챗봇으로\n남깁니다',
    desc: 'PDF 자서전과 디지털 페르소나로\n가족에게 전달됩니다',
  },
]

export default function IntroScreen() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)

  const goNext = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1)
    } else {
      navigate('/auth')
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Skip */}
      <div className="flex justify-end px-6 pt-6 shrink-0">
        <button
          className="text-[16px] text-[#7A6A5C] min-h-[44px] px-2"
          onClick={() => navigate('/auth')}
        >
          건너뛰기
        </button>
      </div>

      {/* Slides */}
      <div className="flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map(({ Icon, title, desc }, i) => (
            <div
              key={i}
              className="w-full shrink-0 h-full flex flex-col items-center justify-center px-8 gap-10"
            >
              <Icon />
              <div className="text-center">
                <h2 className="text-[22px] font-bold text-[#3E3128] whitespace-pre-line leading-snug">
                  {title}
                </h2>
                <p className="mt-3 text-[16px] text-[#7A6A5C] whitespace-pre-line leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="px-6 pb-12 shrink-0 flex flex-col gap-5">
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? 20 : 8,
                height: 8,
                backgroundColor: i === current ? '#8B5E3C' : '#E7DED2',
              }}
            />
          ))}
        </div>
        <Button fullWidth onClick={goNext}>
          {current < slides.length - 1 ? '다음' : '시작하기'}
        </Button>
      </div>
    </div>
  )
}
