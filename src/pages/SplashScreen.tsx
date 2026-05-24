import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'

function LogoIcon() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" rx="24" fill="#F2D9B8" />
      {/* Left page */}
      <path d="M16 30C16 26.686 18.686 24 22 24H46V74H22C18.686 74 16 71.314 16 68V30Z" fill="#EBC7A6" />
      {/* Right page */}
      <path d="M80 30C80 26.686 77.314 24 74 24H50V74H74C77.314 74 80 71.314 80 68V30Z" fill="#FFFDF8" />
      {/* Spine */}
      <rect x="44" y="22" width="8" height="54" rx="4" fill="#8B5E3C" />
      {/* Lines on left page */}
      <line x1="24" y1="38" x2="40" y2="38" stroke="#C8956C" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="46" x2="40" y2="46" stroke="#C8956C" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="54" x2="34" y2="54" stroke="#C8956C" strokeWidth="2.5" strokeLinecap="round" />
      {/* Heart on right page */}
      <path d="M68 44C68 40.5 64.8 38 61.5 41C61 41.5 60 43 60 43C60 43 59 41.5 58.5 41C55.2 38 52 40.5 52 44C52 49 60 54 60 54C60 54 68 49 68 44Z" fill="#C8956C" />
    </svg>
  )
}

export default function SplashScreen() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col h-screen px-6">
      <div
        className="flex-1 flex flex-col items-center justify-center gap-6 transition-opacity duration-700"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <LogoIcon />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-[28px] font-bold text-[#8B5E3C] tracking-[0.15em]">DEARLOG</h1>
          <p className="text-[16px] text-[#7A6A5C]">당신의 이야기를 기록합니다</p>
        </div>
      </div>
      <div className="pb-12">
        <Button fullWidth onClick={() => navigate('/intro')}>
          시작하기
        </Button>
      </div>
    </div>
  )
}
