import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CompanyPage from './CompanyPage'

// jsdom cannot exercise the browser top layer. Browser QA separately verifies
// native modal focus/inert behavior; these mocks test lifecycle and history.
const showDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

function renderCompany() {
  return render(<MemoryRouter><CompanyPage /></MemoryRouter>)
}

describe('Company introduction review', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/company')
    document.body.style.overflow = ''
    vi.stubGlobal('fetch', vi.fn())
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } })
  })

  afterEach(() => {
    if (showDescriptor) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showDescriptor)
    else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal
    if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, 'close', closeDescriptor)
    else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close
    document.body.style.overflow = ''
    window.history.replaceState(null, '', '/')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('offers an explicitly fictional, read-only sample without account or API work', () => {
    renderCompany()
    const sample = screen.getByRole('region', { name: '한 질문이 한 장의 이야기로' })
    expect(within(sample).getByText('로그인 없이 읽는 가상 예시')).toBeInTheDocument()
    expect(within(sample).getByText(/실제 인터뷰나 이용 후기가 아닙니다/)).toBeInTheDocument()
    expect(sample.querySelector('input,textarea,form')).toBeNull()
    for (const link of screen.getAllByRole('link', { name: /가상 자서전 읽어보기/ })) {
      expect(link).toHaveAttribute('href', '#company-sample')
      expect(link).toHaveTextContent('로그인 없이 예시 체험')
    }
    expect(screen.getByRole('link', { name: '이메일로 문의하기' })).toHaveAttribute('href', 'mailto:hello@dear-log.com')
    expect(document.querySelector('.company-page a[href="/auth"]')).toBeNull()
    expect(screen.getByText('현재 예시 체험과 문의를 받고 있습니다.')).toBeInTheDocument()
    expect(screen.getByText(/운영 주체는 디어로그 팀이며, 담당자는 문대한입니다/)).toBeInTheDocument()
    expect(screen.getByText(/앞으로 음성 원본을 계속 보관/)).toHaveTextContent('구체적인 보관 기간과 운영 기준은 정비 중입니다.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('closes an opened image on history navigation, restores focus and releases scrolling', () => {
    renderCompany()
    const trigger = screen.getByRole('button', { name: '인터뷰 화면 크게 보기' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: '인터뷰 화면' })
    expect(dialog).toHaveAttribute('open')
    expect(window.location.hash).toBe('#company-image-interview')
    expect(document.body.style.overflow).toBe('hidden')
    act(() => {
      window.history.replaceState(null, '', '/company')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(dialog).not.toHaveAttribute('open')
    expect(trigger).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('cancels a directly entered image hash without going back to another page', () => {
    window.history.replaceState(null, '', '/company#company-image-review')
    const back = vi.spyOn(window.history, 'back')
    renderCompany()
    const dialog = screen.getByRole('dialog', { name: '기록 확인 화면' })
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(dialog).not.toHaveAttribute('open')
    expect(window.location.pathname).toBe('/company')
    expect(window.location.hash).toBe('')
    expect(back).not.toHaveBeenCalled()
    expect(document.body.style.overflow).toBe('')
  })

  it('ignores unknown image hashes and never exposes a policy draft as a public link', () => {
    window.history.replaceState(null, '', '/company#company-image-unknown')
    const { container } = renderCompany()
    expect(container.querySelector('dialog')).not.toHaveAttribute('open')
    expect(container.querySelector('a[href*="review-v2"],a[href*="PRIVACY-DRAFT"],a[href*="TERMS-DRAFT"]')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
