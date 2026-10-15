import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeId } from '@constants/themePresets'
import { themePresets } from '@constants/themePresets'

type EffectKey = 'ambientParticles' | 'softGlow' | 'animatedTransitions'
type FontFamily = 'manrope-playfair' | 'inter-georgia' | 'roboto-merriweather' | 'lora-crimson' | 'montserrat-lora'

interface ThemeStore {
  currentThemeId: ThemeId
  setTheme: (themeId: ThemeId) => void
  effects: Record<EffectKey, boolean>
  toggleEffect: (effect: EffectKey) => void
  setEffect: (effect: EffectKey, value: boolean) => void
  fontFamily: FontFamily
  setFontFamily: (font: FontFamily) => void
}

const DEFAULT_THEME: ThemeId = themePresets[0]?.id ?? 'verdant-aurora'

const DEFAULT_EFFECTS: Record<EffectKey, boolean> = {
  ambientParticles: true,
  softGlow: true,
  animatedTransitions: true,
}

const DEFAULT_FONT: FontFamily = 'manrope-playfair'

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      currentThemeId: DEFAULT_THEME,
      effects: DEFAULT_EFFECTS,
      fontFamily: DEFAULT_FONT,

      setTheme: (themeId) => set({ currentThemeId: themeId }),
      toggleEffect: (effect) =>
        set((state) => ({
          effects: {
            ...state.effects,
            [effect]: !state.effects[effect],
          },
        })),
      setEffect: (effect, value) =>
        set((state) => ({
          effects: {
            ...state.effects,
            [effect]: value,
          },
        })),
      setFontFamily: (font) => set({ fontFamily: font }),
    }),
    {
      name: 'theme-storage',
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<ThemeStore> | undefined
        // Миграция для версии 3
        if (version < 3) {
          return {
            currentThemeId: state?.currentThemeId || DEFAULT_THEME,
            effects: state?.effects || DEFAULT_EFFECTS,
            fontFamily: state?.fontFamily || DEFAULT_FONT,
          }
        }
        return state as ThemeStore
      },
    }
  )
)
