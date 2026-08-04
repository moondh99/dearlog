import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { splitSecret } from '../lib/security/shamir'
import { encryptText } from '../lib/security/encryption'

// 유산 금고를 여는 화면입니다.
//
// 서버에는 금고 라우트가 처음부터 있었지만 이 화면이 없어서 isVaultSetup 이 true 가 될 길이
// 아예 없었습니다. 그래서 동의 설정의 "사후 공개" 토글도 켜고 끄기만 될 뿐 아무 일도 하지
// 않았습니다. 이 화면이 그 하나 남은 연결입니다.
//
// ponytail: 금고는 답변 원문을 실제로 지우지 않습니다. 원문은 DB에 그대로 있고 서버가 읽는
// 시점에 가려 줍니다(transcriptMaskReason). 원문까지 암호문으로 바꾸려면 자서전·챗봇·출판이
// 전부 복호화를 거쳐야 해서 앱 전체를 다시 짜야 합니다. 화면 문구도 "암호화한다"가 아니라
// "가족에게 닫고 사후에 연다"로 적어 둡니다.

const SHARE_TOTAL = 3

export function generateVaultKey() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

type VaultState = {
  isVaultSetup: boolean
  deathVerificationStatus?: string
}

// 사망 심사가 걸리면 어르신 본인에게 "잘못된 신고라면 취소해 주세요"라는 알림이 갑니다.
// 이 화면에 취소 버튼이 없으면 그 알림이 알려 주기만 하고 아무것도 할 수 없는 문장이 됩니다.

const STATUS_LABEL: Record<string, string> = {
  alive: '보관 중',
  pending_verification: '사망 심사 중',
  released: '가족에게 전수됨',
}

export default function LegacyVaultScreen() {
  const navigate = useNavigate()
  const [vault, setVault] = useState<VaultState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [familyShare, setFamilyShare] = useState<string | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

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

  const handleSetup = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { fetchLocalInterviewRecords, fetchLocalAutobiographyDraft, setupLocalLegacyVault } = await import(
        '../lib/local-server'
      )
      const [recordsRes, draftRes] = await Promise.all([
        fetchLocalInterviewRecords(),
        fetchLocalAutobiographyDraft(),
      ])

      const key = generateVaultKey()
      // 3-of-3 입니다. 서버가 세 조각 중 둘(serverShare, institutionShare)을 같은 DB 행에
      // 들고 있어서, 임계값을 2로 두면 서버 혼자서도 금고가 열립니다. 그러면 나누는 의미가
      // 없습니다. 가족 조각이 반드시 있어야 열리도록 셋 다 요구합니다.
      const [family, server, institution] = splitSecret(key, SHARE_TOTAL, SHARE_TOTAL)

      const [encryptedMemories, encryptedAutobiography] = await Promise.all([
        encryptText(JSON.stringify(recordsRes?.records ?? []), key),
        encryptText(JSON.stringify(draftRes?.draft ?? null), key),
      ])

      await setupLocalLegacyVault({
        encryptedMemories,
        encryptedAutobiography,
        serverShare: JSON.stringify(server),
        institutionShare: JSON.stringify(institution),
      })

      // 가족 조각은 서버에 보내지 않습니다. 지금 이 화면이 이 조각을 보여 주는 유일한 순간입니다.
      setFamilyShare(JSON.stringify(family))
      await loadVault()
    } catch (e) {
      console.error('Failed to set up legacy vault:', e)
      setError(e instanceof Error && e.message ? e.message : '금고를 열지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { resetLocalLegacyVault } = await import('../lib/local-server')
      await resetLocalLegacyVault()
      setFamilyShare(null)
      setConfirmingReset(false)
      await loadVault()
    } catch (e) {
      console.error('Failed to reset legacy vault:', e)
      setError('금고를 해지하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleCancelDeath = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { cancelLocalDeathVerification } = await import('../lib/local-server')
      await cancelLocalDeathVerification()
      await loadVault()
    } catch (e) {
      console.error('Failed to cancel death verification:', e)
      setError(e instanceof Error && e.message ? e.message : '사망 심사를 취소하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleDownloadShare = () => {
    if (!familyShare) return
    const url = URL.createObjectURL(new Blob([familyShare], { type: 'text/plain' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'dearlog-family-key-share.txt'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const isSetup = vault?.isVaultSetup === true
  const isPendingDeath = vault?.deathVerificationStatus === 'pending_verification'

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6F9]">
      <div className="flex items-center px-5 pb-4 pt-12">
        <button
          type="button"
          onClick={() => navigate('/parent/mypage')}
          className="mr-3 flex h-10 w-10 items-center justify-center rounded-full active:bg-[#EDE8F0]"
          aria-label="마이페이지로 돌아가기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18L9 12L15 6" stroke="#2A2830" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-[18px] font-bold text-[#2A2830]">디지털 유산 금고</h1>
          <p className="mt-0.5 text-[12px] text-[#7A767F]">지금까지의 기록을 사후에 전할 준비를 합니다</p>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-5 pb-12">
        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-[#FFF0F0] px-4 py-3 text-[12px] text-[#9E3B3B]">
            {error}
          </p>
        )}

        {vault === null ? (
          <p className="py-10 text-center text-[14px] text-[#7A767F]">불러오는 중입니다…</p>
        ) : (
          <>
            <section
              className="mb-4 rounded-2xl bg-white px-5 py-4"
              style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
            >
              <p className="text-[13px] font-medium text-[#7A767F]">현재 상태</p>
              <p className="mt-1 text-[16px] font-bold text-[#2A2830]">
                {isSetup ? (STATUS_LABEL[vault.deathVerificationStatus ?? 'alive'] ?? '보관 중') : '아직 열지 않음'}
              </p>
            </section>

            {isPendingDeath && (
              <section
                className="mb-4 rounded-2xl border-2 border-[#9E3B3B] bg-white px-5 py-4"
                style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
              >
                <h2 className="text-[15px] font-bold text-[#9E3B3B]">사망 신고가 접수되었습니다</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-[#5A565F]">
                  가족 중 한 분이 사망을 신고했습니다. 유예 기간이 지나면 다른 가족의 승인으로 기록이 전수됩니다.
                  잘못된 신고라면 지금 취소해 주세요.
                </p>
                <button
                  type="button"
                  onClick={handleCancelDeath}
                  disabled={busy}
                  className="mt-3 h-11 w-full rounded-xl bg-[#9E3B3B] text-[14px] font-bold text-white active:opacity-80 disabled:opacity-50"
                >
                  사망 신고 취소하기
                </button>
              </section>
            )}

            <section
              className="mb-4 rounded-2xl bg-white px-5 py-4"
              style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
            >
              <h2 className="text-[15px] font-bold text-[#2A2830]">금고를 열면 이렇게 됩니다</h2>
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-[13px] leading-relaxed text-[#5A565F]">
                <li>가족은 지금까지의 답변 본문과 사진을 볼 수 없게 됩니다.</li>
                <li>부모님 본인도 앱에서는 본문을 볼 수 없게 됩니다. 다시 보시려면 금고를 해지해야 합니다.</li>
                <li>사망 심사가 끝나 전수되면 &lsquo;사후 공개&rsquo;를 켜 둔 기록만 가족에게 열립니다.</li>
                <li>열쇠는 세 조각으로 나뉘고, 셋이 다 모여야 열립니다. 그중 하나는 가족이 보관합니다.</li>
              </ul>
            </section>

            {familyShare && (
              <section
                className="mb-4 rounded-2xl border-2 border-[#9485BE] bg-white px-5 py-4"
                style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
              >
                <h2 className="text-[15px] font-bold text-[#2A2830]">가족 열쇠 조각</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-[#9E3B3B]">
                  이 조각은 서버에 저장하지 않습니다. 이 화면을 벗어나면 다시 볼 수 없으니 지금 가족에게 전해
                  주세요.
                </p>
                <code className="mt-3 block max-h-32 overflow-y-auto break-all rounded-xl bg-[#F8F6F9] px-3 py-3 text-[11px] text-[#2A2830]">
                  {familyShare}
                </code>
                <button
                  type="button"
                  onClick={handleDownloadShare}
                  className="mt-3 h-11 w-full rounded-xl bg-[#2A2830] text-[14px] font-bold text-white active:opacity-80"
                >
                  파일로 저장하기
                </button>
              </section>
            )}

            {isSetup ? (
              <>
                {confirmingReset ? (
                  <div
                    className="rounded-2xl bg-white px-5 py-4"
                    style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
                  >
                    <p className="text-[13px] leading-relaxed text-[#5A565F]">
                      해지하면 보관 중인 열쇠 조각과 백업이 지워지고, 가족이 다시 기록을 볼 수 있게 됩니다.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingReset(false)}
                        className="h-11 flex-1 rounded-xl bg-[#EDE8F0] text-[14px] font-bold text-[#2A2830] active:opacity-80"
                      >
                        그대로 두기
                      </button>
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={busy}
                        className="h-11 flex-1 rounded-xl bg-[#9E3B3B] text-[14px] font-bold text-white active:opacity-80 disabled:opacity-50"
                      >
                        해지하기
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(true)}
                    className="h-12 w-full rounded-xl border border-[#E0DBE8] bg-white text-[14px] font-bold text-[#9E3B3B] active:opacity-80"
                  >
                    금고 해지하기
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleSetup}
                disabled={busy}
                className="h-12 w-full rounded-xl bg-[#9485BE] text-[15px] font-bold text-white active:opacity-80 disabled:opacity-50"
              >
                {busy ? '금고를 여는 중입니다…' : '금고 열기'}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  )
}
