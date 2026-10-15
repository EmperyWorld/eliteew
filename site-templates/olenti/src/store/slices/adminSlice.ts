import {
    ADMIN_STORE_STORAGE_KEY,
    clearAdminToken,
    getAdminToken,
    setAdminToken,
} from '@services/api/authStorage'
import { adminApiClient } from '@services/api/client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
}

interface AdminState {
  adminUser: AdminUser | null
  isAuthenticated: boolean
  sessionChecked: boolean
  login: (password: string) => Promise<boolean>
  logout: () => void
  ensureSession: (force?: boolean) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>
}

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin'

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      adminUser: null,
      isAuthenticated: false,
      sessionChecked: false,

      login: async (password: string) => {
        try {
          const { data } = await adminApiClient.post('/admin/login', {
            email: ADMIN_EMAIL,
            password,
          })

          if (data.token) {
            setAdminToken(data.token)
            set({
              adminUser: data.user,
              isAuthenticated: true,
              sessionChecked: true,
            })
            return true
          }
          return false
        } catch {
          return false
        }
      },

      logout: () => {
        clearAdminToken()
        set({ adminUser: null, isAuthenticated: false, sessionChecked: false })
      },

      ensureSession: async (force = false) => {
        const { sessionChecked } = get()
        if (sessionChecked && !force) {
          return
        }

        const token = getAdminToken()

        if (!token) {
          set({ adminUser: null, isAuthenticated: false, sessionChecked: true })
          return
        }

        try {
          const { data } = await adminApiClient.get('/auth/me')

          if (data?.role === 'ADMIN') {
            set({
              adminUser: {
                id: data.id,
                email: data.email,
                name: data.name || 'Администратор',
                role: data.role,
              },
              isAuthenticated: true,
              sessionChecked: true,
            })
          } else {
            clearAdminToken()
            set({ adminUser: null, isAuthenticated: false, sessionChecked: true })
          }
        } catch {
          clearAdminToken()
          set({ adminUser: null, isAuthenticated: false, sessionChecked: true })
        }
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        try {
          await adminApiClient.post('/auth/change-password', {
            currentPassword,
            newPassword,
          })
          return true
        } catch {
          return false
        }
      },
    }),
    {
      name: ADMIN_STORE_STORAGE_KEY,
      partialize: (state) => ({
        adminUser: state.adminUser,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
