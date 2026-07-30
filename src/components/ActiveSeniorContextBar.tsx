import type { SeniorRecordSpace } from '../hooks/useActiveSeniorContext'

type ActiveSeniorContextBarProps = {
  activeSenior: SeniorRecordSpace | null
  activeSeniorId: string | null
  className?: string
  loading?: boolean
  onChange: (seniorId: string | null) => void
  seniors: SeniorRecordSpace[]
}

export function ActiveSeniorContextBar({
  activeSenior,
  activeSeniorId,
  className = '',
  loading = false,
  onChange,
  seniors,
}: ActiveSeniorContextBarProps) {
  if (loading) {
    return (
      <section className={`rounded-[14px] border border-[#E0DBE8] bg-white/70 px-4 py-3 ${className}`}>
        <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[1.8px] text-[#7A767F]">
          기록 공간 확인 중
        </p>
        <div className="mt-2 h-4 w-32 animate-pulse rounded-full bg-[#E0DBE8]" />
      </section>
    )
  }

  if (!activeSenior) return null

  return (
    <section className={`rounded-[14px] border border-[#E0DBE8] bg-white/75 px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[1.8px] text-[#7A767F]">
            현재 기록 공간
          </p>
          {seniors.length > 1 ? (
            <label className="mt-1 block">
              <span className="sr-only">현재 부모님 기록 공간 선택</span>
              <select
                value={activeSeniorId ?? ''}
                onChange={(event) => onChange(event.target.value || null)}
                className="w-full appearance-none truncate bg-transparent font-serif text-[16px] font-semibold leading-6 text-[#2A2830] outline-none"
              >
                {seniors.map((senior) => (
                  <option key={senior.id} value={senior.id}>
                    {senior.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="mt-1 truncate font-serif text-[16px] font-semibold leading-6 text-[#2A2830]">
              {activeSenior.displayName}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-[#EDE8F0] px-3 py-1 text-[10px] font-medium leading-[15px] text-[#6F648F]">
          선택됨
        </span>
      </div>
      <p className="mt-1 truncate text-[11px] leading-[16.5px] text-[#7A767F]">
        {activeSenior.subtitle}
      </p>
    </section>
  )
}

export function MissingSeniorState({
  message = '먼저 부모님 기록 공간을 만들어 주세요.',
  onCreate,
}: {
  message?: string
  onCreate: () => void
}) {
  return (
    <div className="mx-6 mt-8 rounded-[16px] border border-dashed border-[#E0DBE8] bg-white/75 px-5 py-8 text-center">
      <p className="font-serif text-[18px] font-semibold leading-[27px] text-[#2A2830]">
        기록 공간이 필요해요
      </p>
      <p className="mt-2 text-[13px] leading-[20px] text-[#7A767F]">
        {message}
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 min-h-11 rounded-[14px] bg-[#2A2830] px-5 text-[14px] font-medium leading-[21px] text-[#F7F5FB] transition active:scale-[0.99]"
      >
        기록 공간 만들기
      </button>
    </div>
  )
}
