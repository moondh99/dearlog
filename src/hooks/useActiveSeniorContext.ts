import { useEffect, useMemo, useState } from 'react'
import { fetchFamilyMembers, type LocalFamilyMember } from '../lib/local-server'
import {
  DEMO_SENIOR_ID,
  DEMO_SENIOR_NAME,
} from '../lib/demo/demo-seed-adapter'
import { useAuthStore } from '../store/authStore'
import { useChildStore } from '../store/childStore'
import { useDevModeStore } from '../store/devModeStore'

export type SeniorRecordSpace = LocalFamilyMember & {
  displayName: string
  subtitle: string
}

type ActiveSeniorContextOptions = {
  enabled?: boolean
  preferredSeniorId?: string | null
  autoSelect?: boolean
}

export function getSeniorDisplayName(senior?: Pick<LocalFamilyMember, 'name' | 'recordSpaceName'> | null) {
  return senior?.recordSpaceName || senior?.name || '부모님 기록 공간'
}

function toRecordSpace(member: LocalFamilyMember): SeniorRecordSpace {
  const displayName = getSeniorDisplayName(member)
  const subtitle = member.relationship && !displayName.includes(member.relationship)
    ? `${member.relationship} · ${member.name}`
    : member.name
  return { ...member, displayName, subtitle }
}

const DEMO_RECORD_SPACE: SeniorRecordSpace = {
  id: DEMO_SENIOR_ID,
  name: DEMO_SENIOR_NAME,
  role: 'parent',
  relationship: '어머니',
  isMe: false,
  recordSpaceName: `${DEMO_SENIOR_NAME}님의 기록 공간`,
  displayName: `${DEMO_SENIOR_NAME}님의 기록 공간`,
  subtitle: `어머니 · ${DEMO_SENIOR_NAME}`,
}

export function useActiveSeniorContext({
  enabled,
  preferredSeniorId,
  autoSelect = true,
}: ActiveSeniorContextOptions = {}) {
  const { role } = useAuthStore()
  const isEnabled = enabled ?? role === 'child'
  const { activeSeniorId, setActiveSeniorId } = useChildStore()
  const demoSeededAt = useDevModeStore((state) => state.demoSeededAt)
  const isDemoContext = Boolean(demoSeededAt) && activeSeniorId === DEMO_SENIOR_ID
  const [seniors, setSeniors] = useState<SeniorRecordSpace[]>([])
  const [loading, setLoading] = useState(isEnabled && !isDemoContext)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEnabled || !preferredSeniorId || preferredSeniorId === activeSeniorId) return
    setActiveSeniorId(preferredSeniorId)
  }, [activeSeniorId, isEnabled, preferredSeniorId, setActiveSeniorId])

  useEffect(() => {
    if (!isEnabled) {
      setLoading(false)
      return
    }

    if (isDemoContext) {
      setSeniors([DEMO_RECORD_SPACE])
      setError(null)
      setLoading(false)
      return
    }

    let alive = true
    setLoading(true)
    setError(null)

    fetchFamilyMembers()
      .then((res) => {
        if (!alive) return
        const parentSpaces = (res.members ?? [])
          .filter((member) => member.role === 'parent')
          .map(toRecordSpace)

        setSeniors(parentSpaces)

        const latestActiveId = useChildStore.getState().activeSeniorId
        const desiredId = preferredSeniorId || latestActiveId
        const desiredExists = desiredId && parentSpaces.some((senior) => senior.id === desiredId)

        if (desiredExists) {
          if (latestActiveId !== desiredId) setActiveSeniorId(desiredId)
          return
        }

        if (desiredId) {
          if (latestActiveId !== desiredId) setActiveSeniorId(desiredId)
          return
        }

        if (autoSelect && parentSpaces.length > 0) {
          setActiveSeniorId(parentSpaces[0].id)
        } else if (latestActiveId) {
          setActiveSeniorId(null)
        }
      })
      .catch((err) => {
        if (!alive) return
        console.error('Failed to load senior record spaces:', err)
        setSeniors([])
        setError(err instanceof Error ? err.message : '기록 공간을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [autoSelect, isDemoContext, isEnabled, preferredSeniorId, setActiveSeniorId])

  const activeSenior = useMemo(() => {
    if (!isEnabled) return null
    return seniors.find((senior) => senior.id === activeSeniorId) ?? null
  }, [activeSeniorId, isEnabled, seniors])

  return {
    activeSenior,
    activeSeniorId: activeSenior?.id ?? null,
    error,
    hasSeniors: seniors.length > 0,
    loading,
    seniors,
    setActiveSeniorId,
  }
}
