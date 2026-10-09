import { Link } from 'react-router-dom'
import { SERVICE_RESTRICTION_MESSAGE } from '../../shared/service-access'
import './ReadOnlyService.css'

export default function RestrictedAccessPage() {
  return <main className="readonly-service readonly-notice"><p className="readonly-eyebrow">Dear Log · 이용 안내</p><h1>지금은 예시와 문의를 받습니다</h1><p>{SERVICE_RESTRICTION_MESSAGE}</p><p>초대 링크로 새로 접속하거나 기록을 입력하는 기능은 사용할 수 없습니다. 기존 계정은 로그인 후 허용된 기록을 읽을 수 있습니다.</p><nav aria-label="다음 화면"><Link to="/company">소개와 가상 예시 보기</Link><Link to="/auth">기존 계정 로그인</Link><a href="mailto:hello@dear-log.com">이메일로 문의하기</a></nav></main>
}
