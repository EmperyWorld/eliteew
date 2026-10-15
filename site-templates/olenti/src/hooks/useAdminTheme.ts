import type { ThemeId } from '@constants/themePresets'
import { ADMIN_THEME_STORAGE_KEY } from '@services/api/authStorage'
import { adminApiClient } from '@services/api/client'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import { applyThemeVariables } from '@utils/themeUtils'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AdminTheme = 'light' | 'dark' | 'system' | 'site'

interface AdminThemeState {
  theme: AdminTheme
  resolvedTheme: 'light' | 'dark'
  isLoading: boolean
  _hasHydrated: boolean
  setTheme: (theme: AdminTheme) => Promise<void>
  initTheme: () => void
}

// Определяем системную тему
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Применяем тему к DOM (классы dark/light на documentElement)
const applyTheme = (theme: 'light' | 'dark') => {
  if (typeof document === 'undefined') return

  console.log('[Theme] Applying theme:', theme)

  const root = document.documentElement

  // Удаляем оба класса и добавляем нужный
  if (theme === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else {
    root.classList.remove('dark')
    root.classList.add('light')
  }

  // Также обновляем meta theme-color для мобильных
  const metaTheme = document.querySelector('meta[name="theme-color"]')
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff')
  }
}

export const useAdminTheme = create<AdminThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      resolvedTheme: 'light',
      isLoading: false,
      _hasHydrated: false,

      setTheme: async (theme: AdminTheme) => {
        console.log('[Theme] setTheme called with:', theme)

        let resolvedTheme: 'light' | 'dark' = 'light'

        if (theme === 'system') {
          resolvedTheme = getSystemTheme()
        } else if (theme === 'site') {
          const store = useSiteSettingsStore.getState()

          if (!store.settingsLoaded) {
            await store.loadSettings()
          }

          const siteSettings = useSiteSettingsStore.getState().siteSettings
          const siteThemeId = (siteSettings?.defaultTheme as ThemeId) || 'verdant-aurora'

          console.log('[Theme] Applying site theme:', siteThemeId)
          // Применяем тему сайта через CSS переменные
          applyThemeVariables(siteThemeId)

          // Для dark mode в админке определяем по яркости темы
          // Большинство тем светлые, но можно определить по переменным
          // Пока используем light как fallback, так как админка использует Tailwind dark mode
          resolvedTheme = 'light'
        } else {
          resolvedTheme = theme
        }

        // Применяем dark/light классы для Tailwind
        applyTheme(resolvedTheme)

        // Потом обновляем состояние
        set({ theme, resolvedTheme, isLoading: true })

        // Сохраняем в БД через config API
        try {
          await adminApiClient.put('/admin/config', {
            namespace: 'site',
            items: [
              { key: 'adminTheme', type: 'string', value: theme }
            ]
          })
          console.log('[Theme] Saved to DB:', theme)
        } catch (error) {
          console.error('[Theme] Failed to save theme preference:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      initTheme: async () => {
        const state = get()
        console.log('[Theme] initTheme called, current theme:', state.theme)

        let resolvedTheme: 'light' | 'dark' = 'light'

        if (state.theme === 'system') {
          resolvedTheme = getSystemTheme()
        } else if (state.theme === 'site') {
          try {
            const store = useSiteSettingsStore.getState()

            if (!store.settingsLoaded) {
              await store.loadSettings()
            }

            const siteSettings = useSiteSettingsStore.getState().siteSettings
            const siteThemeId = (siteSettings?.defaultTheme as ThemeId) || 'verdant-aurora'

            console.log('[Theme] Applying site theme in initTheme:', siteThemeId)
            applyThemeVariables(siteThemeId)
          } catch (error) {
            console.error('[Theme] Failed to load site theme:', error)
          }
          resolvedTheme = 'light' // Fallback для dark mode в админке
        } else {
          resolvedTheme = state.theme
        }

        set({ resolvedTheme })
        applyTheme(resolvedTheme)

        // Слушаем изменения системной темы
        if (typeof window !== 'undefined') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
          const handler = () => {
            const currentTheme = get().theme
            if (currentTheme === 'system') {
              const newResolved = getSystemTheme()
              set({ resolvedTheme: newResolved })
              applyTheme(newResolved)
            }
          }
          mediaQuery.addEventListener('change', handler)
        }
      },
    }),
    {
      name: ADMIN_THEME_STORAGE_KEY,
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => async (state) => {
        if (state) {
          console.log('[Theme] Rehydrated from storage:', state.theme)
          state._hasHydrated = true

          let resolved: 'light' | 'dark' = 'light'

          if (state.theme === 'system') {
            resolved = getSystemTheme()
          } else if (state.theme === 'site') {
            try {
              const store = useSiteSettingsStore.getState()

              if (!store.settingsLoaded) {
                await store.loadSettings()
              }

              const siteSettings = useSiteSettingsStore.getState().siteSettings
              const siteThemeId = (siteSettings?.defaultTheme as ThemeId) || 'verdant-aurora'

              console.log('[Theme] Applying site theme in rehydrate:', siteThemeId)
              applyThemeVariables(siteThemeId)
            } catch (error) {
              console.error('[Theme] Failed to load site theme in rehydrate:', error)
            }
            resolved = 'light'
          } else {
            resolved = state.theme
          }

          state.resolvedTheme = resolved
          applyTheme(resolved)
        }
      },
    }
  )
)

// Инициализируем тему при загрузке модуля (для предотвращения мигания)
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem(ADMIN_THEME_STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      const theme = parsed?.state?.theme || 'light'
      let resolved: 'light' | 'dark' = 'light'

      if (theme === 'system') {
        resolved = getSystemTheme()
      } else if (theme === 'site') {
        // Для режима "Сайт" нужно получить настройки, но это асинхронно
        // Пока применяем light, полная инициализация будет в initTheme
        resolved = 'light'
      } else {
        resolved = theme
      }

      applyTheme(resolved)
    } catch {
      // Fallback to light
      applyTheme('light')
    }
  }
}
