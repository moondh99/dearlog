import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useInterviewStore } from '../store/interviewStore'
import { useConsentStore } from '../store/consentStore'
import type { LocalAIProxyAuditSummary, LocalFamilyMember } from '../lib/local-server'

const FALLBACK_FAMILY_MEMBERS = [
  { name: '김영자', role: 'parent' as const, relationship: '부모님' },
  { name: '김민준', role: 'child' as const, relationship: '자녀' },
  { name: '김지영', role: 'child' as const, relationship: '자녀' },
]

const AI_ENDPOINT_LABELS: Record<string, string> = {
  chat_completions: '대화 생성',
  embeddings: '의미 검색',
  speech: '음성 합성',
}

function formatAiEndpointLabel(endpoint: string) {
  return AI_ENDPOINT_LABELS[endpoint] ?? endpoint
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="relative flex-shrink-0"
      style={{ width: 44, height: 26 }}
      aria-pressed={on}
    >
      <div
        className="absolute inset-0 rounded-full transition-colors duration-200"
        style={{ backgroundColor: on ? '#9485BE' : '#E0DBE8' }}
      />
      <div
        className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-200"
        style={{ left: on ? 20 : 2, top: 1 }}
      />
    </button>
  )
}

function formatInvitationStatus(status?: string | null, hasJoined?: boolean) {
  if (status === 'active') return hasJoined ? '링크 활성 · 접속 기록 있음' : '초대 링크 활성'
  if (status === 'expired') return '초대 링크 만료'
  if (status === 'revoked') return '초대 링크 폐기됨'
  if (status === 'used') return '초대 링크 사용됨 · 재발급 필요'
  return '초대 링크 없음'
}

function formatInvitationDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(date)
}

export default function MyPageScreen() {
  const navigate = useNavigate()
  const { userName, role, reset, userId, phoneNumber } = useAuthStore()
  const { transcripts, fetchTranscripts } = useInterviewStore()
  const { consents, fetchConsents, setAll } = useConsentStore()

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(userName)
  const [notifOn, setNotifOn] = useState(true)
  const [familyMembers, setFamilyMembers] = useState<LocalFamilyMember[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newParentName, setNewParentName] = useState('')
  const [addingParent, setAddingParent] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [pendingInvitationId, setPendingInvitationId] = useState<string | null>(null)
  const [auditSummary, setAuditSummary] = useState<LocalAIProxyAuditSummary | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)

  // 서버 role 은 'guardian', 신세대 role 은 'child' 로 대응된다 (local-server 의 role 매핑과 동일)
  const isGuardian = role === 'child'

  const loadFamily = async () => {
    try {
      const { fetchFamilyMembers } = await import('../lib/local-server')
      const res = await fetchFamilyMembers()
      if (res && res.members) {
        setFamilyMembers(res.members)
      }
    } catch (e) {
      console.error('Failed to fetch family members:', e)
      setFamilyMembers(FALLBACK_FAMILY_MEMBERS.map((m, i) => ({ id: `fallback_${i}`, isMe: false, ...m })))
    }
  }

  const loadAuditSummary = async () => {
    setAuditLoading(true)
    try {
      const { fetchLocalAIProxyAuditSummary } = await import('../lib/local-server')
      const res = await fetchLocalAIProxyAuditSummary()
      if (res && res.totals) {
        setAuditSummary(res)
        setAuditError(null)
      } else {
        setAuditSummary(null)
        setAuditError('AI 운영 점검 정보를 불러올 수 없습니다.')
      }
    } catch (e) {
      console.error('Failed to fetch AI proxy audit summary:', e)
      setAuditSummary(null)
      setAuditError(
        e instanceof Error && e.message
          ? e.message
          : 'AI 운영 점검 정보를 불러올 수 없습니다.'
      )
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    loadFamily()
  }, [])

  useEffect(() => {
    if (!isGuardian) return
    void loadAuditSummary()
  }, [isGuardian])

  useEffect(() => {
    void fetchTranscripts()
    void fetchConsents()
  }, [fetchConsents, fetchTranscripts])

  const submittingRef = useRef(false)

  const handleAddParent = async () => {
    if (!newParentName.trim() || submittingRef.current) return
    submittingRef.current = true
    setAddingParent(true)
    try {
      const { createParentInvitation } = await import('../lib/local-server')
      await createParentInvitation(newParentName.trim())
      setNewParentName('')
      setShowAddModal(false)
      await loadFamily()
    } catch (e) {
      console.error('Failed to add parent:', e)
    } finally {
      setAddingParent(false)
      submittingRef.current = false
    }
  }

  const handleCopyToken = (token: string) => {
    const origin = window.location.origin
    const url = `${origin}/parent/autologin?token=${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const handleRotateInvitation = async (member: LocalFamilyMember) => {
    if (pendingInvitationId) return
    const pendingKey = member.invitationId || member.invitation?.id || member.id
    setPendingInvitationId(pendingKey)
    try {
      const invitationId = member.invitationId || member.invitation?.id
      if (invitationId) {
        const { rotateLocalInvitation } = await import('../lib/local-server')
        await rotateLocalInvitation(invitationId)
      } else {
        const { createParentInvitation } = await import('../lib/local-server')
        await createParentInvitation(undefined, member.id)
      }
      await loadFamily()
    } catch (e) {
      console.error('Failed to rotate invitation:', e)
    } finally {
      setPendingInvitationId(null)
    }
  }

  const handleRevokeInvitation = async (member: LocalFamilyMember) => {
    const invitationId = member.invitationId || member.invitation?.id
    if (!invitationId || pendingInvitationId) return
    setPendingInvitationId(invitationId)
    try {
      const { revokeLocalInvitation } = await import('../lib/local-server')
      await revokeLocalInvitation(invitationId)
      await loadFamily()
    } catch (e) {
      console.error('Failed to revoke invitation:', e)
    } finally {
      setPendingInvitationId(null)
    }
  }

  const allIds = transcripts.map((t) => t.id)
  const getConsent = (id: string) => consents[id] ?? { publish: true, chatbot: true }
  const publishAllowedCount = allIds.filter((id) => getConsent(id).publish).length
  const chatbotAllowedCount = allIds.filter((id) => getConsent(id).chatbot).length
  const consentSettingsPath = role === 'parent' ? '/parent/consent-settings' : '/child/consent-settings'

  const handleSaveName = async () => {
    if (nameInput.trim() && userId) {
      try {
        const { updateLocalUserProfile } = await import('../lib/local-server')
        await updateLocalUserProfile({
          userId,
          role: role === 'parent' ? 'senior' : 'guardian',
          name: nameInput.trim(),
          preferredName: role === 'parent' ? '어르신' : '보호자',
          relationship: role === 'parent' ? undefined : '자녀'
        })
        useAuthStore.setState({ userName: nameInput.trim() })
      } catch (e) {
        console.error('Failed to update name:', e)
      }
    }
    setEditingName(false)
  }

  const handleLogout = () => {
    reset()
    // 전체 새로고침으로 메모리에 남은 스토어 상태까지 확실히 버립니다.
    // navigate만 하면 언마운트돼도 Zustand 인스턴스에 이전 가족 데이터가 남습니다.
    window.location.replace('/splash')
  }

  const backPath = role === 'parent' ? '/parent' : '/child'

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F6F9]">
      {/* Header */}
      <div className="flex items-center px-5 pt-12 pb-4">
        <button
          onClick={() => navigate(backPath)}
          className="p-2 -ml-2 mr-2 min-h-[48px] flex items-center"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18L9 12L15 6"
              stroke="#2A2830"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="text-[18px] font-bold text-[#2A2830]">마이페이지</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 px-5">
        {/* 내 정보 카드 */}
        <div
          className="rounded-2xl p-5 mb-4 flex flex-col items-center"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
        >
          <div className="w-20 h-20 rounded-full bg-[#EDE8F0] flex items-center justify-center mb-3">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="16" r="8" fill="#2A2830" />
              <path
                d="M6 40C6 31.163 13.163 25 22 25C30.837 25 38 31.163 38 40"
                stroke="#2A2830"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {editingName ? (
            <div className="flex items-center gap-2 mb-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="h-10 px-3 rounded-xl border border-[#9485BE] bg-[#F8F6F9] text-[17px] font-bold text-[#2A2830] text-center focus:outline-none w-36"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              />
              <button
                onClick={handleSaveName}
                className="text-[14px] text-[#9485BE] font-medium min-h-[48px] px-1"
              >
                저장
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[19px] font-bold text-[#2A2830]">{userName || '이름 없음'}</span>
              <button
                onClick={() => { setNameInput(userName); setEditingName(true) }}
                className="p-1 min-h-[48px] flex items-center"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M11 4H4C2.9 4 2 4.9 2 6V20C2 21.1 2.9 22 4 22H18C19.1 22 20 21.1 20 20V13"
                    stroke="#7A767F"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M18.5 2.5C19.3 1.7 20.7 1.7 21.5 2.5C22.3 3.3 22.3 4.7 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"
                    stroke="#7A767F"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          )}

          <span
            className={`text-[12px] font-medium px-3 py-1 rounded-full mb-3 ${
              role === 'parent' ? 'bg-[#F3EFF5] text-[#2A2830]' : 'bg-[#EEE9F2] text-[#6F648F]'
            }`}
          >
            {role === 'parent' ? '부모님 · 이야기 주인' : '자녀 · 기록 참여자'}
          </span>

          <div className="w-full border-t border-[#E0DBE8] pt-3 flex items-center justify-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M6.62 10.79C8.06 13.62 10.38 15.93 13.21 17.38L15.41 15.18C15.68 14.91 16.08 14.82 16.43 14.94C17.55 15.31 18.76 15.5 20 15.5C20.55 15.5 21 15.95 21 16.5V20C21 20.55 20.55 21 20 21C10.61 21 3 13.39 3 4C3 3.45 3.45 3 4 3H7.5C8.05 3 8.5 3.45 8.5 4C8.5 5.25 8.69 6.45 9.06 7.57C9.18 7.92 9.1 8.31 8.82 8.59L6.62 10.79Z"
                fill="none"
                stroke="#7A767F"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[14px] text-[#7A767F]">
              {phoneNumber ? phoneNumber.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3') : '전화번호 없음'}
            </span>
          </div>
        </div>

        {/* 가족 구성원 및 초대 관리 */}
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
        >
          <div className="px-5 py-4 border-b border-[#E0DBE8] flex items-center justify-between">
            <span className="text-[15px] font-bold text-[#2A2830]">가족 구성원 및 초대</span>
            {role !== 'parent' && (
              <button
                onClick={() => navigate('/child/record-space/new')}
                className="text-[12px] font-bold text-[#9485BE] px-3 py-1.5 rounded-lg bg-[#EEE9F2] active:opacity-75 cursor-pointer"
              >
                부모님 추가하기 ➕
              </button>
            )}
          </div>

          <div className="flex flex-col">
            {familyMembers.map((member, idx) => {
              const isParent = member.role === 'parent'
              const hasJoined = member.hasRegistered
              const invitation = member.invitation
              const invitationId = member.invitationId || invitation?.id || null
              const invitationStatus = member.invitationStatus || invitation?.status || null
              const invitationToken = member.token || invitation?.token || null
              const hasToken = !!invitationToken && invitationStatus === 'active'
              const expiresLabel = formatInvitationDate(member.invitationExpiresAt || invitation?.expiresAt)
              const pendingInvite = pendingInvitationId === (invitationId || member.id)

              return (
                <div
                  key={member.id || (member.name + idx)}
                  className="flex flex-col px-5 py-4 border-b border-[#E0DBE8] last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: isParent ? '#EDE8F0' : '#EEE9F2' }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <circle
                            cx="12"
                            cy="8"
                            r="4"
                            fill={isParent ? '#2A2830' : '#6F648F'}
                          />
                          <path
                            d="M4 20C4 16.686 7.582 14 12 14C16.418 14 20 16.686 20 20"
                            stroke={isParent ? '#2A2830' : '#6F648F'}
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[16px] font-semibold text-[#2A2830] flex items-center gap-1">
                          {member.name}
                          {member.isMe && <span className="text-[11px] text-[#9485BE]">(나)</span>}
                        </span>
                        <span className="text-[12px] text-[#7A767F]">
                          {member.relationship || (isParent ? '부모님' : '자녀')}
                        </span>
                        {isParent && role !== 'parent' && (
                          <span className="text-[11px] text-[#7A767F]">
                            {formatInvitationStatus(invitationStatus, hasJoined)}
                            {expiresLabel ? ` · ${expiresLabel}까지` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isParent && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            hasJoined
                              ? 'bg-[#EEE9F2] text-[#6F648F]'
                              : 'bg-[#F3EFF5] text-[#2A2830]'
                          }`}
                        >
                          {hasJoined ? '연결 완료' : '대기 중'}
                        </span>
                      )}
                      {!isParent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEE9F2] text-[#6F648F]">
                          자녀
                        </span>
                      )}
                    </div>
                  </div>

                  {isParent && role !== 'parent' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {hasToken && (
                        <button
                          onClick={() => handleCopyToken(invitationToken!)}
                          className="flex-grow min-w-[120px] py-2 rounded-lg text-[12px] font-bold transition-all active:scale-98 flex items-center justify-center gap-1 cursor-pointer"
                          style={{
                            backgroundColor: copiedToken === invitationToken ? '#EEE9F2' : '#F8F6F9',
                            color: copiedToken === invitationToken ? '#6F648F' : '#2A2830',
                            border: '1px solid #E0DBE8'
                          }}
                        >
                          {copiedToken === invitationToken ? '복사 완료! 👍' : '초대 링크 복사 📋'}
                        </button>
                      )}
                      <button
                        onClick={() => handleRotateInvitation(member)}
                        disabled={pendingInvite}
                        className="flex-grow min-w-[96px] py-2 rounded-lg text-[12px] font-bold transition-all active:scale-98 disabled:opacity-60 cursor-pointer"
                        style={{ backgroundColor: '#EEE9F2', color: '#6F648F' }}
                      >
                        {pendingInvite ? '처리 중...' : hasToken ? '링크 재발급' : '새 링크 발급'}
                      </button>
                      {invitationId && invitationStatus !== 'revoked' && (
                        <button
                          onClick={() => handleRevokeInvitation(member)}
                          disabled={pendingInvite}
                          className="px-3 py-2 rounded-lg text-[12px] font-bold transition-all active:scale-98 disabled:opacity-60 cursor-pointer"
                          style={{ backgroundColor: '#F3EFF5', color: '#2A2830' }}
                        >
                          폐기
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 동의 설정 */}
        <div className="mb-4">
          {/* 섹션 헤더 + 일괄 설정 */}
          <div className="mb-3 px-1">
            <div>
              <p className="text-[15px] font-bold text-[#2A2830]">동의 설정</p>
              <p className="text-[12px] text-[#7A767F] mt-0.5">답변별로 공개 범위를 설정하세요</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => setAll(allIds, true, true)}
                className="h-8 rounded-full border px-3 text-[12px] font-medium leading-none whitespace-nowrap active:opacity-70"
                style={{ borderColor: '#9485BE', color: '#9485BE', backgroundColor: '#FFFFFF' }}
              >
                전체 공개
              </button>
              <button
                onClick={() => setAll(allIds, false, false)}
                className="h-8 rounded-full border px-3 text-[12px] font-medium leading-none whitespace-nowrap active:opacity-70"
                style={{ borderColor: '#E0DBE8', color: '#7A767F', backgroundColor: '#FFFFFF' }}
              >
                전체 비공개
              </button>
            </div>
          </div>

          <div
            className="rounded-2xl px-5 py-4"
            style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
          >
            {transcripts.length === 0 ? (
              <p className="py-4 text-center text-[14px] text-[#7A767F]">아직 기록된 답변이 없습니다</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '전체 답변', value: transcripts.length },
                    { label: '출판 허용', value: publishAllowedCount },
                    { label: '챗봇 허용', value: chatbotAllowedCount },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-[#F8F6F9] px-2 py-3 text-center">
                      <p className="text-[18px] font-bold text-[#2A2830]">{item.value}</p>
                      <p className="mt-0.5 text-[11px] text-[#7A767F]">{item.label}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(consentSettingsPath)}
                  className="mt-3 h-11 w-full rounded-xl bg-[#2A2830] text-[14px] font-bold text-white active:opacity-80"
                >
                  답변별 설정 보기
                </button>
              </>
            )}
          </div>
        </div>

        {/* 알림 설정 */}
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
        >
          <div className="px-5 py-3 border-b border-[#E0DBE8]">
            <span className="text-[13px] font-medium text-[#7A767F]">알림 설정</span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-[16px] text-[#2A2830]">푸시 알림</p>
              <p className="text-[12px] text-[#7A767F] mt-0.5">인터뷰 일정 및 새 답변 알림</p>
            </div>
            <Toggle on={notifOn} onChange={() => setNotifOn((v) => !v)} />
          </div>
        </div>

        {/* AI 운영 점검 (보호자 전용) */}
        {isGuardian && (
          <div
            className="rounded-2xl overflow-hidden mb-4"
            style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
          >
            <div className="px-5 py-3 border-b border-[#E0DBE8] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={15} color="#7A767F" />
                <span className="text-[13px] font-medium text-[#7A767F]">AI 운영 점검</span>
              </div>
              <button
                type="button"
                onClick={() => void loadAuditSummary()}
                disabled={auditLoading}
                className="text-[12px] font-bold text-[#9485BE] px-3 py-1.5 rounded-lg bg-[#EEE9F2] active:opacity-75 disabled:opacity-60 cursor-pointer"
              >
                {auditLoading ? '확인 중...' : '새로고침'}
              </button>
            </div>

            <div className="px-5 py-4">
              {auditSummary ? (
                <>
                  <p className="text-[12px] text-[#7A767F]">
                    최근 {auditSummary.window.minutes}분 동안의 AI 사용 현황
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { label: '요청', value: `${auditSummary.totals.requests}건` },
                      { label: '성공', value: `${auditSummary.totals.success}건` },
                      { label: '한도 차단', value: `${auditSummary.totals.rateLimited}건` },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-[#F8F6F9] px-2 py-3 text-center">
                        <p className="text-[16px] font-bold text-[#2A2830]">{item.value}</p>
                        <p className="mt-0.5 text-[11px] text-[#7A767F]">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { label: '오류율', value: `${auditSummary.totals.errorRatePercent}%` },
                      { label: '평균 응답', value: `${auditSummary.totals.avgLatencyMs}ms` },
                      { label: '사용량', value: `${auditSummary.totals.estimatedUnits}` },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-[#F8F6F9] px-2 py-3 text-center">
                        <p className="text-[16px] font-bold text-[#2A2830]">{item.value}</p>
                        <p className="mt-0.5 text-[11px] text-[#7A767F]">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <p className="text-[13px] font-bold text-[#2A2830]">알림 임계값</p>
                    <p className="mt-0.5 text-[11px] text-[#7A767F]">
                      오류율 {auditSummary.alertThresholds.errorRatePercent}% · 한도 차단{' '}
                      {auditSummary.alertThresholds.rateLimitedCount}건 · 최소 요청{' '}
                      {auditSummary.alertThresholds.minRequests}건 기준
                    </p>
                    {auditSummary.alerts.length === 0 ? (
                      <p className="mt-2 rounded-xl bg-[#F8F6F9] px-3 py-3 text-[12px] text-[#7A767F]">
                        현재 임계값을 넘은 항목이 없습니다.
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-col gap-2">
                        {auditSummary.alerts.map((alert, idx) => (
                          <div
                            key={`${alert.type}_${idx}`}
                            className="rounded-xl px-3 py-3"
                            style={{
                              backgroundColor: alert.severity === 'critical' ? '#F3EFF5' : '#EEE9F2',
                            }}
                          >
                            <p className="text-[12px] font-bold text-[#2A2830]">
                              {alert.severity === 'critical' ? '긴급' : '주의'} · {alert.value} /{' '}
                              {alert.threshold}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#7A767F] leading-relaxed">
                              {alert.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <p className="text-[13px] font-bold text-[#2A2830]">기능별 사용량</p>
                    {auditSummary.byEndpoint.length === 0 ? (
                      <p className="mt-2 text-[12px] text-[#7A767F]">
                        선택한 기간에 사용 기록이 없습니다.
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-col">
                        {auditSummary.byEndpoint.map((row) => (
                          <div
                            key={row.endpoint}
                            className="flex items-center justify-between py-2 border-b border-[#E0DBE8] last:border-0"
                          >
                            <span className="text-[14px] text-[#2A2830]">
                              {formatAiEndpointLabel(row.endpoint)}
                            </span>
                            <span className="text-[11px] text-[#7A767F]">
                              {row.requests}건 · 차단 {row.rateLimited}건 · 평균 {row.avgLatencyMs}ms
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {auditSummary.recentErrors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[13px] font-bold text-[#2A2830]">최근 오류</p>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {auditSummary.recentErrors.slice(0, 3).map((error) => (
                          <div key={error.id} className="rounded-xl bg-[#F8F6F9] px-3 py-2">
                            <p className="text-[12px] text-[#2A2830]">
                              {formatAiEndpointLabel(error.endpoint)} · {error.outcome}
                            </p>
                            {error.errorMessage && (
                              <p className="mt-0.5 text-[11px] text-[#7A767F] leading-relaxed">
                                {error.errorMessage}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mt-4 text-[11px] text-[#7A767F]">
                    감사 로그 {auditSummary.retention.days}일 보관 · 이번 정리에서{' '}
                    {auditSummary.retention.deletedOldLogs}건 삭제
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-[#7A767F] leading-relaxed">
                  {auditLoading
                    ? 'AI 사용 현황을 확인하고 있어요...'
                    : auditError ?? 'AI 운영 점검 정보를 불러올 수 없습니다.'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 인터뷰 캘린더 바로가기 */}
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
        >
          <button
            onClick={() => navigate('/calendar')}
            className="w-full flex items-center justify-between px-5 py-4 active:opacity-70 min-h-[56px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F3EFF5] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="#2A2830" strokeWidth="1.8" />
                  <path d="M3 9H21" stroke="#2A2830" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M8 2V5M16 2V5" stroke="#2A2830" strokeWidth="1.8" strokeLinecap="round" />
                  <rect x="7" y="13" width="3" height="3" rx="0.5" fill="#2A2830" />
                </svg>
              </div>
              <span className="text-[16px] text-[#2A2830]">인터뷰 캘린더</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 18L15 12L9 6"
                stroke="#7A767F"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="w-full h-12 rounded-xl border border-[#E0DBE8] text-[16px] text-[#7A767F] active:opacity-70"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          로그아웃
        </button>
      </div>

      {/* 부모님 추가 모달 팝업 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#2A2830]/40 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in">
          <div
            className="w-full max-w-[320px] rounded-2xl p-6 shadow-xl flex flex-col gap-4"
            style={{ backgroundColor: '#FFFFFF', animation: 'scaleUp 0.2s ease-out' }}
          >
            <div>
              <h3 className="text-[17px] font-bold text-[#2A2830]">새 부모님 등록</h3>
              <p className="text-[13px] text-[#7A767F] mt-1 leading-relaxed">
                등록할 부모님의 이름이나 호칭(예: 아버지, 어머니, 할머니)을 입력해 주세요.
              </p>
            </div>

            <input
              type="text"
              value={newParentName}
              onChange={(e) => setNewParentName(e.target.value)}
              placeholder="예: 아버지"
              className="w-full h-11 px-3.5 rounded-xl border bg-[#F8F6F9] text-[15px] text-[#2A2830] placeholder:text-[#E0DBE8] outline-none border-[#E0DBE8] focus:border-[#9485BE]"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddParent()}
            />

            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewParentName('')
                }}
                disabled={addingParent}
                className="flex-grow h-11 rounded-xl border border-[#E0DBE8] text-[14px] font-bold text-[#7A767F] bg-[#FFFFFF] active:opacity-75 disabled:opacity-50 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleAddParent}
                disabled={addingParent || !newParentName.trim()}
                className="flex-grow h-11 rounded-xl text-[14px] font-bold text-white bg-[#9485BE] active:opacity-75 disabled:opacity-50 cursor-pointer"
              >
                {addingParent ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
