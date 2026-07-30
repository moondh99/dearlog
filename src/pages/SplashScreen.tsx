import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dearlogAppIcon from '../assets/figma/dearlog-app-icon.png'

export default function SplashScreen() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const visibleTimer = window.setTimeout(() => setVisible(true), 80)
    const nextTimer = window.setTimeout(() => navigate('/intro', { replace: true }), 2500)
    return () => {
      window.clearTimeout(visibleTimer)
      window.clearTimeout(nextTimer)
    }
  }, [navigate])

  return (
    <div className="h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#F8F6F9] text-[#2A2830]">
      <div className="relative mx-auto flex min-h-[844px] w-full max-w-[388px] flex-col bg-[#F8F6F9]">
        <main
          className="relative min-h-px flex-1 overflow-hidden transition-opacity duration-700"
          style={{ opacity: visible ? 1 : 0 }}
        >
          <span className="sr-only">DEARLOG</span>

          <div className="absolute left-1/2 top-[186.5px] h-[125px] w-[125px] -translate-x-1/2 overflow-hidden rounded-[36.923px]">
            <img
              src={dearlogAppIcon}
              alt=""
              className="pointer-events-none absolute left-[-147.37%] top-[-107.36%] h-[304.19%] w-[540.79%] max-w-none"
            />
          </div>

          <p className="absolute left-1/2 top-[339.5px] w-[143px] -translate-x-1/2 text-[9.874px] font-medium uppercase leading-[13.464px] tracking-[3.1416px] text-[#2A2830]">
            FAMILY ARCHIVE
          </p>

          <h1
            className="absolute left-1/2 top-[358.5px] -translate-x-1/2 text-[47px] font-semibold leading-[55.895px] text-[#183025]"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            Dearlog
          </h1>
        </main>

        <button
          type="button"
          onClick={() => navigate('/intro')}
          className="absolute inset-0 z-10 bg-transparent text-transparent outline-none focus-visible:ring-2 focus-visible:ring-[#2A2830]/35 focus-visible:ring-inset"
          aria-label="시작하기"
        />
      </div>
    </div>
  )
}
