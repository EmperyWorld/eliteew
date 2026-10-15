import { API_ENDPOINTS } from '@constants/api'
import {
    USER_STORE_STORAGE_KEY,
    clearUserToken,
    setUserToken,
} from '@services/api/authStorage'
import { publicApiClient } from '@services/api/client'
import type { User } from '@typings/user'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  login: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })

        try {
          const { data } = await publicApiClient.post(API_ENDPOINTS.AUTH_LOGIN, { email, password })

          const user: User = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            phone: data.user.phone || '',
            role: data.user.role,
            createdAt: new Date(data.user.createdAt ?? Date.now()),
          }

          setUserToken(data.token)

          set({
            user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          })
          return true
        } catch (error: unknown) {
          let message = 'Неверный email или пароль'

          if (typeof error === 'object' && error && 'response' in error) {
            const err = error as { response?: { data?: { message?: string } } }
            if (err.response?.data?.message) {
              message = err.response.data.message
            }
          }

          set({ error: message, isLoading: false })
          return false
        }
      },

      register: async (name: string, email: string, password: string) => {
        set({ isLoading: true, error: null })

        try {
          const { data } = await publicApiClient.post(API_ENDPOINTS.AUTH_REGISTER, { name, email, password })

          const user: User = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            phone: data.user.phone || '',
            role: data.user.role,
            createdAt: new Date(data.user.createdAt ?? Date.now()),
          }

          setUserToken(data.token)

          set({
            user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          })
          return true
        } catch (error: unknown) {
          let message = 'Ошибка регистрации'

          if (typeof error === 'object' && error && 'response' in error) {
            const err = error as { response?: { data?: { message?: string } } }
            if (err.response?.data?.message) {
              message = err.response.data.message
            }
          }

          set({ error: message, isLoading: false })
          return false
        }
      },

      logout: () => {
        clearUserToken()
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null
        })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: USER_STORE_STORAGE_KEY,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
