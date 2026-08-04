import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { combineShares, type Share } from '../lib/security/shamir'
import { decryptText } from '../lib/security/encryption'

// 보호자가 사망 심사를 진행하는 화면입니다.
//
// 서버에는 trigger/approve/cancel/shares 라우트가 모두 있었지만 부르는 화면이 없어서,
// 유산이 전수되는 경로 전체가 실제로는 한 번도 돌지 않았습니다. #15 에서 신고와 승인을
// 갈라 놓았으니 이제 그 절차를 사람이 볼 수 있게 합니다.
//
// 승인 가능 여부는 서버가 판단합니다. 화면은 유예 시간처럼 서버가 내려준 값으로만 미리
// 막고, 신고자·보호자 수 규칙은 서버 응답(403)의 문구를 그대로 보여 줍니다. 규칙을 양쪽에
// 적어 두면 서버만 고쳤을 때 화면이 조용히 거짓말을 합니다.

type VaultState = {
  isVaultSetup: boolean
  deathVerificationStatus?: string
  deathTriggeredById?: string | null
  deathTriggeredAt?: string | null
  deathReviewRemainingMs?: number
  encryptedMemories?: string | null
  encryptedAutobiography?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  alive: '보관 중',
  pending_verification: '사망 심사 중',
  released: '가족에게 전수됨',
}

function formatRemaining(ms: number) {
  const hours = Math.ceil(ms / (60 * 60 * 1000))
  return hours > 24 ? `${Math.floor(hours / 24)}일 ${hours % 24}시간` : `${hours}시간`
}

function formatTriggeredAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '알 수 없음' : date.toLocaleString('ko-KR')
}

export default function LegacyReviewScreen() {
  const navigate = useNavigate()
  const { userId } = useAuthStore()
  const [vault, setVault] = useState<VaultState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingTrigger, setConfirmingTrigger] = useState(false)
  const [familyShareText, setFamilyShareText] = useState('')
  const [unlocked, setUnlocked] = useState<string[] | null>(null)

  const loadVault = async () => {
    try {
      const { fetchLocalLegacyVault } = await import('../lib/local-server')
      const res = await fetchLocalLegacyVault()
      setVault(res?.vault ?? { isVaultSetup: false })
    } catch (e) {
      console.error('Failed to fetch legacy vault:', e)
      setError('금고 상태를 불러오지 못했습니다.')
      setVault({ isVaultSetup: false })
    }
  }

  useEffect(() => {
    void loadVault()
  }, [])

  // trigger / approve / cancel 은 흐름이 같습니다. 눌러서, 서버 문구를 그대로 보여 주고,
  // 다시 읽어 옵니다.
  const runStep = async (step: 'trigger' | 'approve' | 'cancel') => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const client = await import('../lib/local-server')
      if (step === 'trigger') await client.triggerLocalDeathVerification()
      if (step === 'approve') await client.approveLocalDeathVerification()
      if (step === 'cancel') await client.cancelLocalDeathVerification()
      setConfirmingTrigger(false)
      await loadVault()
    } catch (e) {
      console.error(`Failed to ${step} death verification:`, e)
      setError(e instanceof Error && e.message ? e.message : '요청을 처리하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      let familyShare: Share
      try {
        familyShare = JSON.parse(familyShareText.trim())
      } catch {
        setError('가족 열쇠 조각을 읽지 못했습니다. 받은 파일 내용을 그대로 붙여 넣어 주세요.')
        return
      }

      const { fetchLocalLegacyShares } = await import('../lib/local-server')
      const released = await fetchLocalLegacyShares()

      // 3-of-3 입니다. 가족 조각이 없으면 서버가 가진 두 조각만으로는 열리지 않습니다.
      const key = combineShares([familyShare, JSON.parse(released.serverShare), JSON.parse(released.institutionShare)])
      const decrypted = await decryptText(vault?.encryptedMemories ?? '', key)
      const records = JSON.parse(decrypted)
      setUnlocked(
        (Array.isArray(records) ? records : [])
          .map((record: any) => String(record?.transcriptText ?? '').trim())
          .filter(Boolean),
      )
    } catch (e) {
      console.error('Failed to unlock legacy vault:', e)
      setError('조각이 맞지 않아 금고를 열지 못했습니다. 가족이 보관한 조각인지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const handleShareFile = (file: File | undefined) => {
    if (!file) return
    void file.text().then(setFamilyShareText)
  }

  const status = vault?.deathVerificationStatus ?? 'alive'
  const isSetup = vault?.isVaultSetup === true
  const remainingMs = vault?.deathReviewRemainingMs ?? 0
  const triggeredByMe = !!userId && vault?.deathTriggeredById === userId

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6F9]">
      <div className="flex items-center px-5 pb-4 pt-12">
        <button
          type="button"
          onClick={() => navigate('/child/mypage')}
          className="mr-3 flex h-10 w-10 items-center justify-center rounded-full active:bg-[#EDE8F0]"
          aria-label="마이페이지로 돌아가기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18L9 12L15 6" stroke="#2A2830" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-[18px] font-bold text-[#2A2830]">디지털 유산 심사</h1>
          <p className="mt-0.5 text-[12px] text-[#7A767F]">부모님이 남긴 기록을 전달받는 절차입니다</p>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-5 pb-12">
        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-[#FFF0F0] px-4 py-3 text-[12px] leading-relaxed text-[#9E3B3B]">
            {error}
          </p>
        )}

        {vault === null ? (
          <p className="py-10 text-center text-[14px] text-[#7A767F]">불러오는 중입니다…</p>
        ) : !isSetup ? (
          <section
            className="rounded-2xl bg-white px-5 py-4"
            style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
          >
            <p className="text-[16px] font-bold text-[#2A2830]">아직 금고가 없습니다</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#5A565F]">
              부모님이 마이페이지에서 디지털 유산 금고를 열어야 이 절차를 쓸 수 있습니다.
            </p>
          </section>
        ) : (
          <>
            <section
              className="mb-4 rounded-2xl bg-white px-5 py-4"
              style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
            >
              <p className="text-[13px] font-medium text-[#7A767F]">현재 상태</p>
              <p className="mt-1 text-[16px] font-bold text-[#2A2830]">{STATUS_LABEL[status] ?? '보관 중'}</p>
            </section>

            {status === 'alive' && (
              <section
                className="rounded-2xl bg-white px-5 py-4"
                style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
              >
                <h2 className="text-[15px] font-bold text-[#2A2830]">사망 신고</h2>
                <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-[13px] leading-relaxed text-[#5A565F]">
                  <li>신고하면 부모님 본인과 다른 가족 모두에게 알림이 갑니다.</li>
                  <li>신고한 분은 승인할 수 없습니다. 다른 가족이 승인해야 합니다.</li>
                  <li>유예 기간이 지나기 전에는 승인되지 않습니다. 그동안 누구나 취소할 수 있습니다.</li>
                </ul>
                {confirmingTrigger ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingTrigger(false)}
                      className="h-11 flex-1 rounded-xl bg-[#EDE8F0] text-[14px] font-bold text-[#2A2830] active:opacity-80"
                    >
                      그만두기
                    </button>
                    <button
                      type="button"
                      onClick={() => void runStep('trigger')}
                      disabled={busy}
                      className="h-11 flex-1 rounded-xl bg-[#9E3B3B] text-[14px] font-bold text-white active:opacity-80 disabled:opacity-50"
                    >
                      신고하기
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingTrigger(true)}
                    className="mt-3 h-11 w-full rounded-xl border border-[#E0DBE8] bg-white text-[14px] font-bold text-[#9E3B3B] active:opacity-80"
                  >
                    사망 신고하기
                  </button>
                )}
              </section>
            )}

            {status === 'pending_verification' && (
              <section
                className="rounded-2xl bg-white px-5 py-4"
                style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
              >
                <h2 className="text-[15px] font-bold text-[#2A2830]">사망 심사가 진행 중입니다</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-[#5A565F]">
                  {triggeredByMe ? '내가 신고했습니다.' : '다른 가족이 신고했습니다.'}
                  {vault?.deathTriggeredAt ? ` (${formatTriggeredAt(vault.deathTriggeredAt)})` : ''}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#5A565F]">
                  {remainingMs > 0
                    ? `${formatRemaining(remainingMs)} 뒤에 승인할 수 있습니다.`
                    : '유예 기간이 지나 승인할 수 있습니다.'}
                </p>
                {triggeredByMe && (
                  <p className="mt-2 rounded-xl bg-[#F8F6F9] px-3 py-2 text-[12px] leading-relaxed text-[#7A767F]">
                    신고한 분은 승인할 수 없습니다. 다른 가족에게 승인을 부탁해 주세요. 연결된 가족이 나뿐이면 유예
                    기간이 지난 뒤 직접 승인할 수 있습니다.
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void runStep('cancel')}
                    disabled={busy}
                    className="h-11 flex-1 rounded-xl bg-[#EDE8F0] text-[14px] font-bold text-[#2A2830] active:opacity-80 disabled:opacity-50"
                  >
                    심사 취소하기
                  </button>
                  <button
                    type="button"
                    onClick={() => void runStep('approve')}
                    disabled={busy || remainingMs > 0}
                    className="h-11 flex-1 rounded-xl bg-[#9E3B3B] text-[14px] font-bold text-white active:opacity-80 disabled:opacity-50"
                  >
                    승인하기
                  </button>
                </div>
              </section>
            )}

            {status === 'released' && (
              <section
                className="rounded-2xl bg-white px-5 py-4"
                style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
              >
                <h2 className="text-[15px] font-bold text-[#2A2830]">가족 열쇠 조각으로 열기</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-[#5A565F]">
                  금고를 열 때 가족에게 전달된 조각이 필요합니다. 서버가 보관하던 두 조각은 심사가 승인되어 이미
                  풀렸습니다.
                </p>
                <textarea
                  value={familyShareText}
                  onChange={(event) => setFamilyShareText(event.target.value)}
                  placeholder='{"x":1,"data":"..."}'
                  aria-label="가족 열쇠 조각"
                  className="mt-3 h-24 w-full resize-none rounded-xl bg-[#F8F6F9] px-3 py-3 text-[12px] text-[#2A2830]"
                />
                <input
                  type="file"
                  accept=".txt,text/plain"
                  aria-label="가족 열쇠 조각 파일"
                  onChange={(event) => handleShareFile(event.target.files?.[0])}
                  className="mt-2 w-full text-[12px] text-[#7A767F]"
                />
                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={busy || !familyShareText.trim()}
                  className="mt-3 h-11 w-full rounded-xl bg-[#9485BE] text-[14px] font-bold text-white active:opacity-80 disabled:opacity-50"
                >
                  {busy ? '여는 중입니다…' : '기록 열기'}
                </button>

                {unlocked && (
                  <div className="mt-4 border-t border-[#E0DBE8] pt-4">
                    <h3 className="text-[14px] font-bold text-[#2A2830]">전달받은 기록 {unlocked.length}개</h3>
                    {unlocked.length === 0 ? (
                      <p className="mt-2 text-[13px] text-[#7A767F]">금고에 담긴 답변이 없습니다.</p>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-2">
                        {unlocked.map((text, index) => (
                          <li
                            key={index}
                            className="rounded-xl bg-[#F8F6F9] px-3 py-3 text-[13px] leading-relaxed text-[#2A2830]"
                          >
                            {text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
