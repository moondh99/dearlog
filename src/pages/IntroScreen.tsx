import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Camera, FileText, Images, Mail, MessageCircle, Mic, Phone, SquareCheck } from 'lucide-react'
import onboardingFamilyAlbum from '../assets/figma/onboarding-family-album.jpg'
import introFamilyArchive from '../assets/figma/intro-family-archive.png'

function StepBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-5 top-[38px] z-30 flex h-10 min-w-10 items-center justify-center rounded-full bg-white/80 text-[#2A2830] shadow-[0_2px_10px_rgba(42,40,48,0.08)] transition active:scale-95"
      aria-label="이전 단계로"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}

function LandingIntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#F8F6F9] text-[#2A2830]">
      <div className="mx-auto flex min-h-[844px] w-full max-w-[388px] flex-col bg-[#F8F6F9]">
        <main className="relative h-[807px] shrink-0 overflow-hidden bg-[#F8F6F9]">
          <p className="absolute left-[150px] top-9 h-[9px] w-[79.5px] text-[5.5px] font-medium uppercase leading-[7.5px] tracking-[1.75px] text-[#2A2830]">
            FAMILY ARCHIVE
          </p>
          <p className="absolute left-1/2 top-[45px] -translate-x-1/2 font-serif text-[27px] font-semibold leading-[31.136px] text-[#203029]">
            Dearlog
          </p>

          <img
            src={introFamilyArchive}
            alt=""
            className="absolute left-[46px] top-[103px] h-[342px] w-[342px] max-w-none object-cover"
          />

          <section className="absolute left-6 top-[421px] flex h-[239px] w-[340px] flex-col items-start">
            <div className="h-[127px] w-full bg-[#F8F6F9] pt-[37px]">
              <h1 className="font-serif text-[28px] font-semibold leading-[37px] text-[#2A2830]">
                부모님의 이야기를
                <br />
                얼마나 알고 계신가요?
              </h1>
            </div>
            <div className="h-px w-full bg-white/20" />
            <p className="h-[74px] w-full whitespace-pre-line pt-0 text-[13.5px] font-light leading-[21.938px] text-[#6F737B]">
              함께한 시간은 많았지만,{'\n'}
              아직 묻지 못한 삶의 이야기가{'\n'}
              남아 있을 수 있습니다.
            </p>
          </section>

          <button
            type="button"
            onClick={onStart}
            className="absolute left-6 top-[708px] h-[51px] w-[340px] rounded-2xl bg-[#2A2830] text-center text-[15px] font-medium leading-[22.5px] tracking-[0.025em] text-white shadow-[0_6px_12px_rgba(31,45,70,0.25)] transition-transform active:scale-[0.99]"
          >
            디어로그 시작하기
          </button>
        </main>
      </div>
    </div>
  )
}

const features = [
  {
    Icon: Camera,
    title: '사진 보고 이야기하기',
    description: '잊고 있던 이야기가 자연스럽게 시작돼요.',
  },
  {
    Icon: MessageCircle,
    title: '질문에 답하기',
    description: '듣고 싶은 이야기를 차근차근 물어볼 수 있어요.',
  },
  {
    Icon: Phone,
    title: '전화로 이야기하기',
    description: '앱이 어려워도 통화 화면에서 편하게 말할 수 있어요.',
  },
]

function OnboardingFeatureScreen({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#F8F6F9] text-[#2F3136]">
      <div className="mx-auto flex min-h-[844px] w-full max-w-[388px] flex-col bg-[#F8F6F9]">
        <StepBackButton onClick={onBack} />
        <div className="relative h-[71px] shrink-0">
          <div className="absolute inset-x-0 top-[-1px]">
          </div>
        </div>

        <section className="px-6 pt-6">
          <div className="relative h-[196px] overflow-hidden rounded-3xl border border-[#D9CFC4]/50 bg-[linear-gradient(154deg,#EDE8E0_4%,#E4DECA_96%)]">
            <article className="absolute left-5 top-5 h-[112.375px] w-28 overflow-hidden rounded-2xl border border-[#E8E6E1] bg-white p-px shadow-[0_4px_18px_rgba(31,45,70,0.13)]">
              <div className="flex h-[68px] items-center justify-center bg-[linear-gradient(148deg,#D9CFC4_0%,#C5BAA8_100%)]">
                <Camera className="h-[18px] w-[18px] text-[#9C948A]" aria-hidden="true" />
              </div>
              <div className="px-2.5 py-2">
                <p className="whitespace-nowrap text-[9px] font-bold leading-[12.375px] text-[#2F3136]">
                  고향 집의 봄
                </p>
                <p className="pt-0.5 text-[8px] font-normal leading-3 text-[#A8B7A3]">
                  1965 · 경상도
                </p>
              </div>
            </article>

            <article className="absolute left-[212px] top-5 w-[108px] rounded-2xl border border-[#E8E6E1] bg-white p-[13px] shadow-[0_4px_9px_rgba(31,45,70,0.13)]">
              <div className="flex h-7 w-7 items-center justify-center rounded-[14px] bg-[#EEF0EB]">
                <MessageCircle className="h-3 w-3 text-[#A8B7A3]" aria-hidden="true" />
              </div>
              <p className="w-[82px] pt-2 text-[9.5px] font-normal leading-[14.25px] text-[#2F3136]">
                이 사진 찍은 날
                <br />
                기억하세요?
              </p>
              <div className="flex h-5 items-center gap-1 pt-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A8B7A3]" />
                <span className="text-[8px] leading-3 text-[#A8B7A3]">답변 대기 중</span>
              </div>
            </article>

            <div className="absolute left-[141.5px] top-[105.13px] flex flex-col items-center gap-1.5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1F2D46] shadow-[0_6px_12px_rgba(31,45,70,0.35)]">
                <Mic className="h-[22px] w-[22px] text-white" aria-hidden="true" />
              </div>
              <p className="text-[8.5px] leading-[12.75px] text-[#6F737B]">목소리로 답하기</p>
            </div>

            <div className="absolute left-[258.53px] top-[141.25px] flex items-center gap-1.5 rounded-full border border-[#E8E6E1] bg-white px-[13px] py-[7px] shadow-[0_2px_5px_rgba(0,0,0,0.08)]">
              <Phone className="h-2.5 w-2.5 text-[#A8B7A3]" aria-hidden="true" />
              <span className="whitespace-nowrap text-[8.5px] leading-[12.75px] text-[#6F737B]">통화로</span>
            </div>
          </div>
        </section>

        <section className="h-[114px] shrink-0 px-8 pt-7">
          <h1 className="font-serif text-[23px] font-normal leading-[34.5px] tracking-[-0.01em] text-[#2F3136]">
            사진과 질문으로 기억을 열고,
            <br />
            목소리로 이야기를 남겨요
          </h1>
        </section>

        <section className="min-h-px flex-[224_0_0] px-6">
          <div className="flex flex-col gap-2">
            {features.map(({ Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-[#E8E6E1] bg-white">
                <div className="flex items-start gap-3.5 px-[17px] py-[15px]">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] bg-[#EEF0EB]">
                    <Icon className="h-[15px] w-[15px] text-[#A8B7A3]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="whitespace-nowrap text-[12.5px] font-bold leading-[18.75px] text-[#2F3136]">
                      {title}
                    </h2>
                    <p className="pt-0.5 text-[12px] font-normal leading-[18.15px] text-[#6F737B]">
                      {description}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="relative h-[149px] shrink-0">
          <div className="absolute inset-x-8 top-6 flex h-1.5 items-center justify-center gap-2" aria-hidden="true">
            <span className="h-1.5 w-[22px] rounded-full bg-[#2A2830]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#D9CFC4]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#D9CFC4]" />
          </div>
          <button
            type="button"
            onClick={onNext}
            className="absolute left-6 top-[49px] h-[51px] w-[340px] rounded-2xl bg-[#2A2830] text-center text-[15px] font-medium leading-[22.5px] tracking-[0.025em] text-white shadow-[0_6px_12px_rgba(31,45,70,0.25)] transition-transform active:scale-[0.99]"
          >
            다음
          </button>
        </footer>
      </div>
    </div>
  )
}

const archiveFeatures = [
  {
    Icon: BookOpen,
    title: '가족 기록집',
    description: '모인 이야기를 한데 모아 오래 간직할 수 있는 가족 기록으로 정리해요.',
  },
  {
    Icon: MessageCircle,
    title: '기억 대화방',
    description: '남겨진 이야기를 바탕으로 궁금한 순간마다 다시 꺼내볼 수 있어요.',
  },
]

function OnboardingArchiveScreen({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#F8F6F9] text-[#2F3136]">
      <div className="relative mx-auto h-[844px] w-full max-w-[388px] overflow-hidden bg-[#F8F6F9]">
        <div className="absolute inset-x-0 top-[-1px]">
        </div>
        <StepBackButton onClick={onBack} />

        <section className="absolute inset-x-0 top-[71px] h-[248px]">
          <div className="absolute left-6 top-6 h-[200px] w-[195px] overflow-hidden rounded-2xl bg-[#1F2D46]">
            <img
              src={onboardingFamilyAlbum}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
              <p className="pb-4 text-[8px] font-normal leading-3 tracking-[4px] text-white/35">DEARLOG</p>
              <p className="font-serif text-[18px] font-normal leading-[23.4px] text-white">
                김영숙의
                <br />
                이야기
              </p>
              <span className="my-3 h-px w-8 bg-[#A8B7A3]" />
              <p className="text-[8.5px] font-normal leading-[12.75px] tracking-[0.85px] text-white/30">
                2024년 겨울
              </p>
            </div>
            <span className="absolute inset-y-0 left-0 w-[3px] bg-white/5" />
          </div>

          <div className="absolute left-[204px] top-10 h-[185px] w-40 overflow-hidden rounded-2xl border border-[#E8E6E1] bg-white p-px shadow-[0_8px_32px_rgba(31,45,70,0.16)]">
            <div className="border-b border-[#E8E6E1] px-4 pb-[9px] pt-3.5">
              <p className="whitespace-nowrap text-[8px] font-normal uppercase leading-3 tracking-[2px] text-[#A8B7A3]">
                I. 어린 시절
              </p>
            </div>
            <div className="px-3 pt-3">
              <div className="h-[72px] overflow-hidden rounded-[14px]">
                <img src={onboardingFamilyAlbum} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
            <div className="px-3 pt-2.5">
              <span className="block h-[5px] w-[120.594px] rounded-full bg-[#EDE8E1]" />
              <span className="mt-1.5 block h-[5px] w-[100.5px] rounded-full bg-[#EDE8E1]" />
              <span className="mt-1.5 block h-[5px] w-[109.875px] rounded-full bg-[#EDE8E1]" />
            </div>
          </div>

          <div className="absolute left-[114px] top-[169.31px] w-[190px] rounded-bl-md rounded-br-2xl rounded-tl-2xl rounded-tr-2xl border border-[#E8E6E1] bg-white px-[17px] py-[13px] shadow-[0_6px_10px_rgba(31,45,70,0.12)]">
            <p className="w-[156px] font-serif text-[9.5px] font-normal leading-[14.725px] text-[#2F3136]">
              "고향 집 부엌의 구수한 향기는 지금도 눈을 감으면 생생히 떠올라요."
            </p>
            <div className="flex h-6 items-center pt-2">
              <span className="rounded-full bg-[#EEF0EB] px-2 py-0.5 text-[7.5px] leading-[11.25px] text-[#A8B7A3]">
                1장 · 어린 시절의 집
              </span>
            </div>
          </div>
        </section>

        <section className="absolute inset-x-0 top-[319px] h-[113px] px-8 pt-8">
          <h1 className="font-serif text-[23px] font-normal leading-[34.5px] tracking-[-0.01em] text-[#2F3136]">
            가족 기록집으로 남기고,
            <br />
            기억 대화방에서 다시 꺼내요
          </h1>
        </section>

        <section className="absolute inset-x-0 top-[440px] flex h-[188px] flex-col gap-2 px-6">
          {archiveFeatures.map(({ Icon, title, description }) => (
            <article key={title} className="h-[93px] rounded-2xl border border-[#E8E6E1] bg-white">
              <div className="flex items-start gap-3.5 p-[17px]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#EEF0EB]">
                  <Icon className="h-[15px] w-[15px] text-[#A8B7A3]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="whitespace-nowrap text-[13px] font-bold leading-[19.5px] text-[#2F3136]">
                    {title}
                  </h2>
                  <p className="pt-1 text-[12px] font-normal leading-[18px] text-[#7A767F]">
                    {description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <footer className="absolute inset-x-0 top-[692px] h-[149px]">
          <div className="absolute inset-x-8 top-6 flex h-1.5 items-center justify-center gap-2" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D9CFC4]" />
            <span className="h-1.5 w-[22px] rounded-full bg-[#2A2830]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#D9CFC4]" />
          </div>
          <button
            type="button"
            onClick={onNext}
            className="absolute left-6 top-[49px] h-[51px] w-[340px] rounded-2xl bg-[#2A2830] text-center text-[15px] font-medium leading-[22.5px] tracking-[0.025em] text-white shadow-[0_6px_12px_rgba(31,45,70,0.25)] transition-transform active:scale-[0.99]"
          >
            다음
          </button>
        </footer>
      </div>
    </div>
  )
}

const processSteps = [
  {
    number: '01',
    Icon: FileText,
    title: '기록 공간 만들기',
  },
  {
    number: '02',
    Icon: Mail,
    title: '부모님 초대하기',
  },
  {
    number: '03',
    Icon: Images,
    title: '사진과 질문 준비하기',
  },
  {
    number: '04',
    Icon: SquareCheck,
    title: '가족 기록집 완성하기',
  },
]

function OnboardingProcessScreen({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#F8F6F9] text-[#2F3136]">
      <div className="relative mx-auto h-[844px] w-full max-w-[388px] overflow-hidden bg-[#F8F6F9]">
        <div className="absolute inset-x-0 top-0">
        </div>
        <StepBackButton onClick={onBack} />

        <section className="absolute inset-x-0 top-[94px] h-[219px] px-8 pb-7 pt-8">
          <h1 className="font-serif text-[25px] font-normal leading-[36.25px] tracking-[-0.01em] text-[#2F3136]">
            부모님은 이야기만,
            <br />
            가족은 함께 정리해요
          </h1>
          <p className="pt-3.5 text-[12.5px] font-normal leading-[23.75px] text-[#6F737B]">
            자녀가 기록 공간을 만들고 부모님을 초대하면, 부모님은 초대받은 화면에서 편하게 이야기만 남기면 됩니다. 정리와 검수는 가족이 함께 도와요.
          </p>
        </section>

        <section className="absolute inset-x-0 top-[305px] h-[337.25px]">
          {processSteps.map(({ number, Icon, title }, index) => {
            const isLeft = index % 2 === 0
            const isBottom = index >= 2

            return (
              <article
                key={number}
                className="absolute h-[162.625px] w-[164px] rounded-2xl border border-[#E8E6E1] bg-white px-[17px] py-[21px] shadow-[0_2px_6px_rgba(31,45,70,0.06)]"
                style={{
                  left: isLeft ? 24 : 200,
                  top: isBottom ? 174.63 : 0,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif text-[10px] font-normal leading-[15px] tracking-[2px] text-[#D9CFC4]">
                    {number}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-[14px] bg-[#EEF0EB]">
                    <Icon className="h-5 w-5 text-[#A8B7A3]" aria-hidden="true" />
                  </span>
                </div>
                <h2 className="mt-3 whitespace-nowrap text-[12.5px] font-bold leading-[18.125px] text-[#2F3136]">
                  {title}
                </h2>
              </article>
            )
          })}
        </section>

        <footer className="absolute inset-x-0 top-[719px] h-[125px]">
          <div className="absolute inset-x-8 top-0 flex h-1.5 items-center justify-center gap-2" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D9CFC4]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#D9CFC4]" />
            <span className="h-1.5 w-[22px] rounded-full bg-[#2A2830]" />
          </div>
          <button
            type="button"
            onClick={onNext}
            className="absolute left-6 top-[23px] h-[51px] w-[340px] rounded-2xl bg-[#2A2830] text-center text-[15px] font-medium leading-[22.5px] tracking-[0.025em] text-white shadow-[0_6px_12px_rgba(31,45,70,0.25)] transition-transform active:scale-[0.99]"
          >
            다음
          </button>
        </footer>
      </div>
    </div>
  )
}

export default function IntroScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'landing' | 'features' | 'archive' | 'process'>('landing')

  if (step === 'process') {
    return <OnboardingProcessScreen onBack={() => setStep('archive')} onNext={() => navigate('/auth')} />
  }

  if (step === 'archive') {
    return <OnboardingArchiveScreen onBack={() => setStep('features')} onNext={() => setStep('process')} />
  }

  if (step === 'features') {
    return <OnboardingFeatureScreen onBack={() => setStep('landing')} onNext={() => setStep('archive')} />
  }

  return <LandingIntroScreen onStart={() => setStep('features')} />
}
