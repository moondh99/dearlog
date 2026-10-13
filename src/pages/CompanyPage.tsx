import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, Mail, Maximize2, X } from 'lucide-react'
import './CompanyPage.css'

const steps = [
  { title: '가족이 질문을 건넵니다', text: '어린 시절, 첫 일터, 함께한 날들. 궁금했던 이야기를 질문으로 남깁니다.' },
  { title: '부모님이 목소리로 답합니다', text: '준비된 질문을 따라 편하게 이야기합니다. 말로 남긴 기억을 글로 정리합니다.' },
  { title: '가족이 함께 확인합니다', text: '원문과 정리된 이야기를 살펴봅니다. 뜻이 잘 전해졌는지 확인하고 기록을 다듬습니다.' },
  { title: '한 사람의 삶을 기록합니다', text: '확인한 이야기를 챕터별로 모읍니다. 가족이 읽고 간직할 자서전으로 이어갑니다.' },
]

function SampleLink({ className = '' }: { className?: string }) {
  return <a href="#company-sample" className={`company-service-link ${className}`}><span>가상 자서전 읽어보기<span className="company-service-caption">로그인 없이 예시 체험</span></span><ArrowUpRight size={18} aria-hidden="true" /></a>
}

const screens = {
  interview: { title: '인터뷰 화면', src: '/company/interview.png', alt: '디어로그 실제 인터뷰 화면. 가족이 준비한 질문을 선택해 음성으로 답하는 화면' },
  review: { title: '기록 확인 화면', src: '/company/review.png', alt: '디어로그 실제 기록 확인 화면. 음성 인터뷰의 정리본과 원문을 비교해 읽을 수 있다' },
  autobiography: { title: '자서전 화면', src: '/company/autobiography.png', alt: '디어로그 실제 자서전 화면. 챕터별로 정리된 이야기를 읽는 화면' },
} as const
type ScreenKey = keyof typeof screens

const faqs = [
  { question: '디어로그는 어떤 서비스인가요?', answer: '부모님의 음성 인터뷰를 가족이 함께 확인하고 자서전으로 남기는 서비스입니다. 가족이 질문을 건네고, 부모님이 이야기한 기억을 챕터별 기록으로 이어갑니다.' },
  { question: '기록은 어떤 순서로 만들어지나요?', answer: '질문 → 음성 인터뷰 → 가족 확인 → 챕터별 기록의 순서로 이어집니다. 가족은 질문을 준비하고, 인터뷰 뒤에는 원문과 정리본을 살펴볼 수 있습니다.' },
  { question: '가족은 어떤 역할을 하나요?', answer: '궁금했던 이야기를 질문으로 건네고, 정리된 글에 부모님이 말한 뜻이 잘 담겼는지 함께 확인합니다. 기억의 주인인 부모님의 이야기를 중심에 둡니다.' },
  { question: '소개 페이지의 화면과 이야기는 실제인가요?', answer: '제품 화면은 실제 UI를 가상 데이터로 구성해 캡처했습니다. 읽어보기의 자서전은 설명을 위해 만든 가상 예시이며, 실제 가족의 인터뷰나 이용 후기가 아닙니다. 현재 예시 체험과 문의를 받고 있습니다. 가상 자서전은 로그인이나 녹음 없이 읽을 수 있습니다.' },
  { question: '서비스 문의나 협업 제안은 어디로 보내나요?', answer: 'hello@dear-log.com으로 이메일을 보내주세요. 아래 문의 영역의 이메일 링크를 누르면 사용 중인 메일 앱에서 작성할 수 있습니다.' },
]

export default function CompanyPage() {
  const [preview, setPreview] = useState<ScreenKey | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previewTrigger = useRef<HTMLButtonElement | null>(null)
  const pushedPreview = useRef(false)

  useEffect(() => {
    const syncPreview = () => {
      const key = window.location.hash.replace('#company-image-', '')
      setPreview(Object.hasOwn(screens, key) ? key as ScreenKey : null)
    }
    syncPreview()
    window.addEventListener('popstate', syncPreview)
    window.addEventListener('hashchange', syncPreview)
    return () => {
      window.removeEventListener('popstate', syncPreview)
      window.removeEventListener('hashchange', syncPreview)
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!preview) {
      if (dialog.open) {
        dialog.close()
        previewTrigger.current?.focus({ preventScroll: true })
      }
      return
    }
    if (!dialog.open) dialog.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [preview])

  const openPreview = (key: ScreenKey, trigger: HTMLButtonElement) => {
    previewTrigger.current = trigger
    pushedPreview.current = true
    window.history.pushState(window.history.state, '', `#company-image-${key}`)
    setPreview(key)
  }

  const closePreview = () => {
    setPreview(null)
    if (pushedPreview.current) {
      pushedPreview.current = false
      window.history.back()
    } else {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    }
  }

  const previewButton = (key: ScreenKey) => <button type="button" className="company-preview-button" onClick={event => openPreview(key, event.currentTarget)}><Maximize2 size={16} aria-hidden="true" />{screens[key].title} 크게 보기</button>

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
        <SampleLink className="company-header-cta" />
      </header>

      <main id="company-main" tabIndex={-1}>
        <section className="company-hero company-container" aria-labelledby="company-title">
          <div className="company-hero-copy">
            <p className="company-kicker">가족의 이야기를 오래 간직하는 방법</p>
            <h1 id="company-title">부모님의 목소리를,<br />우리 가족의<br className="company-desktop-break" /> 자서전으로.</h1>
            <p className="company-lead">질문에 답하신 부모님의 이야기를 가족이 함께 확인하고, 챕터별 기록으로 남깁니다.</p>
            <div className="company-hero-actions">
              <SampleLink />
              <a className="company-text-link" href="mailto:hello@dear-log.com">이메일로 문의하기</a>
            </div>
            <p className="company-hero-note">현재 예시 체험과 문의를 받고 있습니다.</p>
          </div>
          <figure className="company-hero-product">
            <div className="company-product-heading"><span>이야기는, 한 번의 질문에서</span><span aria-hidden="true">↘</span></div>
            <div className="company-phone company-hero-phone">
              <img src="/company/interview.png" alt="디어로그 실제 인터뷰 화면. 가족이 준비한 질문을 선택해 음성으로 답하는 화면" width={390} height={720} fetchPriority="high" />
            </div>
            <figcaption>실제 제품 화면 · 가상 데이터로 구성한 로컬 시연</figcaption>
            {previewButton('interview')}
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

        <section id="company-video" className="company-video company-container" aria-labelledby="company-video-title">
          <div className="company-video-copy">
            <p className="company-kicker">영상으로 보기</p>
            <h2 id="company-video-title">질문 하나가 기록이 되는 과정</h2>
            <p>부모님이 질문에 답하고, 가족이 함께 확인하고, 모인 이야기가 기록집으로 이어지는 약 40초의 무음 영상입니다.</p>
            <ol id="company-video-steps" className="company-video-steps">
              <li><strong>부모님이 질문에 편하게 답합니다.</strong> 말하기 어려우면 직접 입력해도 됩니다.</li>
              <li><strong>가족이 원문과 정리본을 함께 확인합니다.</strong> 말한 뜻이 잘 담겼는지 살펴봅니다.</li>
              <li><strong>모인 이야기를 한 권의 기록집으로 엮습니다.</strong> 챕터별 구성을 점검합니다.</li>
            </ol>
            <span className="company-video-note">실제 제품 화면 · 가상 데이터로 구성한 로컬 시연 · 영상 속 가족과 이야기는 모두 가상입니다.</span>
          </div>
          <div className="company-phone company-video-phone">
            <video controls muted playsInline preload="metadata" poster="/company/service-demo-poster.jpg" width={390} height={928} aria-label="디어로그 사용 영상" aria-describedby="company-video-steps">
              <source src="/company/service-demo.mp4" type="video/mp4" />
              이 브라우저에서는 영상을 재생할 수 없습니다. 위의 세 단계 설명으로 내용을 확인할 수 있습니다.
            </video>
          </div>
        </section>

        <section id="company-sample" className="company-sample company-container" aria-labelledby="company-sample-title">
          <div className="company-section-heading">
            <div><p className="company-kicker">로그인 없이 읽는 가상 예시</p><h2 id="company-sample-title">한 질문이 한 장의 이야기로</h2></div>
            <p>설명을 위해 만든 읽기 전용 예시입니다.<br />실제 인터뷰나 이용 후기가 아닙니다.</p>
          </div>
          <div className="company-sample-layout">
            <div className="company-sample-conversation"><h3>질문과 답변</h3><dl><div><dt>가족이 건넨 질문</dt><dd>처음 일을 시작한 날은 어땠나요?</dd></div><div><dt>부모님의 답변 · 가상 예시</dt><dd>“첫 월급을 받던 날, 집에 가는 길에 빵을 샀어. 가족하고 나눠 먹고 싶었거든.”</dd></div></dl><p>같은 이야기를 챕터별 기록으로 정리하면, 가족이 다시 읽을 수 있는 한 장이 됩니다.</p></div>
            <article className="company-sample-page" aria-labelledby="company-sample-chapter"><p className="company-sample-chapter-number">가상 자서전 · 일과 가족</p><h3 id="company-sample-chapter">첫 월급, 함께 나눈 빵</h3><p>첫 월급을 받은 날, 집에 가는 길에 빵을 샀다. 가족과 나누어 먹고 싶은 마음이었다.</p><p className="company-sample-end">질문과 답변을 바탕으로 정리한 설명용 문장</p></article>
          </div>
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
                <figcaption><h3>말한 뜻을, 다시 확인합니다.</h3><p>원문과 정리본을 살펴보며 부모님의 이야기가 잘 담겼는지 확인합니다.</p><span>실제 제품 화면 · 가상 데이터</span>{previewButton('review')}</figcaption>
              </figure>
              <figure>
                <div className="company-product-stage company-book-stage"><div className="company-phone"><img src="/company/autobiography.png" alt="디어로그 실제 자서전 화면. 챕터별로 정리된 이야기를 읽는 화면" width={390} height={720} loading="lazy" /></div></div>
                <figcaption><h3>흩어진 기억을, 한 권으로.</h3><p>챕터별로 모인 기록을 자서전으로 이어갑니다. 가족이 함께 읽을 이야기가 됩니다.</p><span>실제 제품 화면 · 가상 데이터</span>{previewButton('autobiography')}</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section id="company-team" className="company-team company-container" aria-labelledby="company-team-title">
          <div><p className="company-kicker">우리가 만드는 것</p><h2 id="company-team-title">안녕하세요,<br />디어로그 팀입니다.</h2><span className="company-stage">현재 사업화를 준비하고 있습니다</span></div>
          <div className="company-team-copy"><p>우리는 부모님의 이야기가 가족 안에서 오래 읽히기를 바랍니다. 질문, 목소리 인터뷰 경험, 가족이 함께 확인하는 과정, 챕터별 기록 화면을 만들고 있습니다.</p><p>지금은 서비스를 다듬으며 사업화를 준비하고 있습니다. 당분간 가상 자서전 예시 체험과 이메일 문의를 받고 있습니다. 운영 주체는 디어로그 팀이며, 담당자는 문대한입니다.</p><p>앞으로 음성 원본을 계속 보관하며 가족이 다시 듣고 기록을 이어갈 수 있는 서비스를 만들고자 합니다. 구체적인 보관 기간과 운영 기준은 정비 중입니다.</p><h3>우리가 다듬는 세 가지 영역</h3><dl><div><dt>제품과 질문 설계</dt><dd>가족이 궁금했던 이야기를 질문으로 건넬 수 있게 합니다.</dd></div><div><dt>음성 인터뷰와 기록</dt><dd>부모님이 목소리로 답하고, 이야기를 글로 살펴보는 경험을 만듭니다.</dd></div><div><dt>가족 확인과 읽기</dt><dd>원문과 정리본을 함께 확인하고 챕터별 기록을 읽는 화면을 다듬습니다.</dd></div></dl></div>
        </section>

        <section className="company-faq company-container" aria-labelledby="company-faq-title"><div className="company-section-heading"><div><p className="company-kicker">디어로그가 궁금하다면</p><h2 id="company-faq-title">자주 묻는 질문</h2></div></div><div className="company-faq-list">{faqs.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>

        <section id="company-contact" className="company-contact" aria-labelledby="company-contact-title">
          <div className="company-container company-contact-inner"><div><p className="company-kicker">문의와 협업</p><h2 id="company-contact-title">이야기의 다음 장을<br />함께 열어볼까요?</h2><p>서비스 문의와 협업 제안은 이메일로 보내주세요.</p></div><a href="mailto:hello@dear-log.com" className="company-email"><Mail size={23} strokeWidth={1.5} aria-hidden="true" /><span>hello@dear-log.com</span><ArrowUpRight size={22} aria-hidden="true" /></a></div>
        </section>
      </main>

      <footer className="company-footer company-container"><div className="company-footer-brand">Dear Log <span>디어로그 팀</span></div><p>한 사람의 목소리, 우리 가족의 기록.</p><a href="/company/fonts/README.txt">사용한 글꼴과 라이선스</a></footer>
      <dialog ref={dialogRef} className="company-preview-dialog" aria-labelledby="company-preview-title" aria-describedby="company-preview-caption" onCancel={event => { event.preventDefault(); closePreview() }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePreview() } }}>
        <div className="company-preview-heading"><h2 id="company-preview-title">{preview ? screens[preview].title : '제품 화면'}</h2><button type="button" className="company-preview-close" aria-label="화면 확대 닫기" onClick={closePreview} autoFocus><X size={22} aria-hidden="true" /></button></div>
        <p id="company-preview-caption">실제 제품 화면 · 가상 데이터로 구성한 로컬 시연</p>
        {preview && <img src={screens[preview].src} alt={screens[preview].alt} width={390} height={720} />}
      </dialog>
    </div>
  )
}
