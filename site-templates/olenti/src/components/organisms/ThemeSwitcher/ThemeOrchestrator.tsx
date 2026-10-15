import type { ThemeId } from '@constants/themePresets'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import { useThemeStore } from '@store/slices/themeSlice'
import { applyFontFamily, applyThemeVariables, updateEffectClasses } from '@utils/themeUtils'
import { memo, useEffect, useRef } from 'react'

const ThemeOrchestratorComponent: React.FC = () => {
  const currentThemeId = useThemeStore((state) => state.currentThemeId)
  const effects = useThemeStore((state) => state.effects)
  const fontFamily = useThemeStore((state) => state.fontFamily)
  const defaultTheme = useSiteSettingsStore((state) => (state.siteSettings.defaultTheme as ThemeId) || 'verdant-aurora')
  const isInitialized = useRef(false)

  // Определяем какую тему использовать:
  // 1. Если пользователь уже выбирал тему (есть в localStorage) - используем её
  // 2. Иначе используем тему по умолчанию из настроек сайта
  const hasUserTheme = typeof window !== 'undefined' && localStorage.getItem('theme-storage')
  const effectiveTheme = hasUserTheme ? currentThemeId : defaultTheme

  // Объединённый эффект для всех изменений темы
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Применяем все настройки темы за один раз
    applyThemeVariables(effectiveTheme)
    updateEffectClasses(effects)
    applyFontFamily(fontFamily)

    isInitialized.current = true
  }, [effectiveTheme, effects, fontFamily])

  return null
}

export const ThemeOrchestrator = memo(ThemeOrchestratorComponent)
