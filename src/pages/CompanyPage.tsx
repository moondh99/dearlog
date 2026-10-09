import { useEffect } from 'react'
import { ArrowUpRight, BookOpen, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import './CompanyPage.css'

const steps = [
  { title: '가족이 질문을 건넵니다', text: '어린 시절, 첫 일터, 함께한 날들. 궁금했던 이야기를 질문으로 남깁니다.' },
  { title: '부모님이 목소리로 답합니다', text: '준비된 질문을 따라 편하게 이야기합니다. 말로 남긴 기억을 글로 정리합니다.' },
  { title: '가족이 함께 확인합니다', text: '원문과 정리된 이야기를 살펴봅니다. 뜻이 잘 전해졌는지 확인하고 기록을 다듬습니다.' },
  { title: '한 사람의 삶을 기록합니다', text: '확인한 이야기를 챕터별로 모읍니다. 가족이 읽고 간직할 자서전으로 이어갑니다.' },
]

function ServiceLink({ className = '' }: { className?: string }) {
  return <Link to="/auth" className={`company-service-link ${className}`}>서비스 시작하기 <ArrowUpRight size={18} aria-hidden="true" /></Link>
}

export default function CompanyPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = '디어로그 팀 | 부모님의 목소리를 가족의 자서전으로'
    const description = document.createElement('meta')
    description.name = 'description'
    description.content = '부모님의 음성 인터뷰를 가족이 함께 확인하고 자서전으로 남기는 서비스, Dear Log. 디어로그 팀과 기록 과정을 소개합니다.'
    document.head.append(description)
    return () => {
      document.title = previousTitle
      description.remove()
    }
  }, [])

  return (
    <div className="company-page">
      <a className="company-skip" href="#company-main">본문으로 건너뛰기</a>
      <header className="company-header company-container">
        <a href="#company-main" className="company-brand" aria-label="디어로그 소개 첫 화면">
          <BookOpen size={26} strokeWidth={1.25} aria-hidden="true" />
          <span>Dear Log<span className="company-brand-caption">디어로그</span></span>
        </a>
        <nav className="company-nav" aria-label="회사 소개">
          <a href="#company-process">기록 과정</a>
          <a href="#company-product">서비스 화면</a>
          <a href="#company-team">팀 소개</a>
        </nav>
        <ServiceLink className="company-header-cta" />
      </header>

      <main id="company-main" tabIndex={-1}>
        <section className="company-hero company-container" aria-labelledby="company-title">
          <div className="company-hero-copy">
            <p className="company-kicker">가족의 이야기를 오래 간직하는 방법</p>
            <h1 id="company-title">부모님의 목소리를,<br />우리 가족의<br className="company-desktop-break" /> 자서전으로.</h1>
            <p className="company-lead">디어로그는 부모님의 음성 인터뷰를<br className="company-desktop-break" /> 가족이 함께 확인하고 자서전으로 남기는 서비스입니다.</p>
            <div className="company-hero-actions">
              <ServiceLink />
              <a className="company-text-link" href="#company-process">어떻게 기록하나요?</a>
            </div>
            <p className="company-hero-note">말하는 분의 기억을 존중하고, 가족의 확인을 거칩니다.</p>
          </div>
          <figure className="company-hero-product">
            <div className="company-product-heading"><span>이야기는, 한 번의 질문에서</span><span aria-hidden="true">↘</span></div>
            <div className="company-phone company-hero-phone">
              <img src="/company/interview.png" alt="디어로그 실제 인터뷰 화면. 가족이 준비한 질문을 선택해 음성으로 답하는 화면" width={390} height={720} fetchPriority="high" />
            </div>
            <figcaption>실제 제품 화면 · 가상 데이터로 구성한 로컬 시연</figcaption>
          </figure>
        </section>

        <section className="company-story company-container" aria-labelledby="company-story-title">
          <div className="company-story-copy">
            <p className="company-kicker">미처 묻지 못했던 이야기</p>
            <h2 id="company-story-title">우리가 아는 부모님은<br />한 사람의 삶의 일부이기에.</h2>
            <p>어떤 아이였는지, 처음 일하던 날은 어땠는지,<br className="company-desktop-break" /> 무엇을 소중하게 여겨왔는지.</p>
            <p>디어로그는 안부 다음의 질문을 돕습니다.<br className="company-desktop-break" /> 평범한 대화 속 기억을, 다시 읽을 수 있는 기록으로 옮깁니다.</p>
          </div>
          <div className="company-excerpt">
            <p className="company-excerpt-label">설명용 예시</p>
            <p className="company-excerpt-question">“처음 일을 시작한 날은 어땠나요?”</p>
            <blockquote>“첫 월급을 받던 날,<br />집에 가는 길에 빵을 샀어.<br />가족하고 나눠 먹고 싶었거든.”</blockquote>
            <p className="company-excerpt-foot">누군가의 처음이, 가족에게 남는 한 문장이 됩니다.</p>
          </div>
        </section>

        <section id="company-process" className="company-process company-container" aria-labelledby="company-process-title">
          <div className="company-section-heading">
            <div><p className="company-kicker">목소리에서 한 권의 기록까지</p><h2 id="company-process-title">함께 완성하는 이야기</h2></div>
            <p>질문을 건네고, 듣고, 확인하고, 남깁니다.<br />기록의 중심에는 부모님과 가족이 있습니다.</p>
          </div>
          <ol className="company-steps">
            {steps.map((step, index) => <li key={step.title}><span className="company-step-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}
          </ol>
        </section>

        <section id="company-product" className="company-product" aria-labelledby="company-product-title">
          <div className="company-container">
            <div className="company-section-heading">
              <div><p className="company-kicker">디어로그 안에서</p><h2 id="company-product-title">기록이 쌓이는 자리</h2></div>
              <p>가족의 질문과 한 사람의 기억이 만나는 화면.<br />아래는 가상 데이터로 캡처한 실제 제품 UI입니다.</p>
            </div>
            <div className="company-product-grid">
              <figure>
                <div className="company-product-stage"><div className="company-phone"><img src="/company/review.png" alt="디어로그 실제 기록 확인 화면. 음성 인터뷰의 정리본과 원문을 비교해 읽을 수 있다" width={390} height={720} loading="lazy" /></div></div>
                <figcaption><h3>말한 뜻을, 다시 확인합니다.</h3><p>원문과 정리본을 살펴보며 부모님의 이야기가 잘 담겼는지 확인합니다.</p><span>실제 제품 화면 · 가상 데이터</span></figcaption>
              </figure>
              <figure>
                <div className="company-product-stage company-book-stage"><div className="company-phone"><img src="/company/autobiography.png" alt="디어로그 실제 자서전 화면. 챕터별로 정리된 이야기를 읽는 화면" width={390} height={720} loading="lazy" /></div></div>
                <figcaption><h3>흩어진 기억을, 한 권으로.</h3><p>챕터별로 모인 기록을 자서전으로 이어갑니다. 가족이 함께 읽을 이야기가 됩니다.</p><span>실제 제품 화면 · 가상 데이터</span></figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section id="company-team" className="company-team company-container" aria-labelledby="company-team-title">
          <div><p className="company-kicker">우리가 만드는 것</p><h2 id="company-team-title">안녕하세요,<br />디어로그 팀입니다.</h2><span className="company-stage">현재 사업화를 준비하고 있습니다</span></div>
          <div className="company-team-copy"><p>우리는 부모님의 이야기가 가족 안에서 오래 읽히기를 바랍니다. 질문하기 쉽고, 이야기하기 편하고, 함께 확인할 수 있는 기록 경험을 만들고 있습니다.</p><p>지금은 서비스를 다듬으며 사업화를 준비하고 있습니다. 가족의 기록에 관심이 있는 분, 디어로그와 협업을 이야기하고 싶은 분의 연락을 기다립니다.</p><dl><div><dt>기억의 주인은 부모님</dt><dd>이야기의 의미와 공개 의사를 존중합니다.</dd></div><div><dt>기록은 가족의 확인을 거쳐</dt><dd>정리된 글을 원문과 함께 살펴볼 수 있게 합니다.</dd></div></dl></div>
        </section>

        <section id="company-contact" className="company-contact" aria-labelledby="company-contact-title">
          <div className="company-container company-contact-inner"><div><p className="company-kicker">문의와 협업</p><h2 id="company-contact-title">이야기의 다음 장을<br />함께 열어볼까요?</h2><p>서비스 문의와 협업 제안은 이메일로 보내주세요.</p></div><a href="mailto:hello@dear-log.com" className="company-email"><Mail size={23} strokeWidth={1.5} aria-hidden="true" /><span>hello@dear-log.com</span><ArrowUpRight size={22} aria-hidden="true" /></a></div>
        </section>
      </main>

      <footer className="company-footer company-container"><div className="company-footer-brand">Dear Log <span>디어로그 팀</span></div><p>한 사람의 목소리, 우리 가족의 기록.</p><a href="/company/fonts/README.txt">사용한 글꼴과 라이선스</a></footer>
    </div>
  )
}
