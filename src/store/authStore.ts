import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UserRole } from '../types/user'
import { registerLocalPhoneAccount, updateLocalUserRole, updateLocalUserProfile } from '../lib/local-server'

interface AuthState {
  role: UserRole | null
  userName: string
  userId: string | null
  phoneNumber: string
  authToken: string | null
  setRole: (role: UserRole) => Promise<void>
  setUserName: (name: string, phone: string, isLogin: boolean, birthDate?: string) => Promise<void>
  setTokenLoginState: (userId: string, userName: string, phoneNumber: string, authToken?: string | null) => void
  reset: () => void
}

// 로그아웃할 때 authStore(sessionStorage)만 비우면 가족 데이터를 담은 localStorage 스토어가
// 그대로 남습니다. 같은 기기를 다음 사람이 쓰면 이전 가족의 사진·대화·질문이 캐시에서 그대로
// 보이고, 남아 있던 activeSeniorId가 모든 요청에 붙어 새 계정 조회까지 어긋납니다.
const PERSISTED_FAMILY_DATA_KEYS = [
  'dearlog-child',
  'dearlog-interview',
  'dearlog-consent',
  'dearlog-autobiography',
  'dearlog-calendar',
  'dearlog-scheduled-call',
]

export function clearPersistedFamilyData() {
  if (typeof localStorage === 'undefined') return
  for (const key of PERSISTED_FAMILY_DATA_KEYS) {
    localStorage.removeItem(key)
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      role: null,
      userName: '',
      userId: null,
      phoneNumber: '',
      authToken: null,
      setRole: async (role) => {
        set({ role })
        const userId = get().userId
        if (userId) {
          const dbRole = role === 'parent' ? 'senior' : 'guardian'
          try {
            const res = await updateLocalUserRole(userId, dbRole)
            set({ authToken: res.authToken })
          } catch (e) {
            console.error('updateLocalUserRole error:', e)
          }
        }
      },
      setUserName: async (name, phone, isLogin, birthDate) => {
        const sanitizedPhone = phone?.replace(/[^\d]/g, '')
        if (!sanitizedPhone) {
          throw new Error('휴대폰 번호를 입력해 주세요.')
        }
        try {
          const res = await registerLocalPhoneAccount(sanitizedPhone, name, isLogin, birthDate)
          const user = res.user
          const frontendRole: UserRole = user.role === 'senior' ? 'parent' : 'child'

          set({
            userName: user.name,
            role: frontendRole,
            phoneNumber: sanitizedPhone,
            userId: user.id,
            authToken: res.authToken
          })

          if (!isLogin) {
            const profileRes = await updateLocalUserProfile({
              userId: user.id,
              role: 'guardian',
              name: name,
              birthDate,
              preferredName: '보호자',
              relationship: '자녀'
            })
            set({ authToken: profileRes.authToken })
          }
        } catch (e) {
          console.error('setUserName backend sync error:', e)
          throw e
        }
      },
      setTokenLoginState: (userId, userName, phoneNumber, authToken = null) => {
        set({ role: 'parent', userId, userName, phoneNumber, authToken })
      },
      reset: () => {
        set({ role: null, userName: '', userId: null, phoneNumber: '', authToken: null })
        clearPersistedFamilyData()
      },
    }),
    {
      name: 'dearlog-auth',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
