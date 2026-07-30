export type UserRole = 'parent' | 'child'

export interface User {
  name: string
  role: UserRole
  phone?: string
}
