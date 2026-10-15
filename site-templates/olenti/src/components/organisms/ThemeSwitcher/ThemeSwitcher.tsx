import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Paintbrush, X } from 'lucide-react'
import { themePresets } from '@constants/themePresets'
import { useThemeStore } from '@store/slices/themeSlice'
import { useAdminStore } from '@store/slices/adminSlice'

const fontOptions: Array<{
  id: 'manrope-playfair' | 'inter-georgia' | 'roboto-merriweather' | 'lora-crimson' | 'montserrat-lora'
  label: string
  display: string
  body: string
}> = [
  {
    id: 'manrope-playfair',
    label: 'Manrope & Playfair',
    display: 'Playfair Display',
    body: 'Manrope',
  },
  {
    id: 'inter-georgia',
    label: 'Inter & Georgia',
    display: 'Georgia',
    body: 'Inter',
  },
  {
    id: 'roboto-merriweather',
    label: 'Roboto & Merriweather',
    display: 'Merriweather',
    body: 'Roboto',
  },
  {
    id: 'lora-crimson',
    label: 'Lora & Crimson',
    display: 'Crimson Text',
    body: 'Lora',
  },
  {
    id: 'montserrat-lora',
    label: 'Montserrat & Lora',
    display: 'Lora',
    body: 'Montserrat',
  },
]

export const ThemeSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const currentThemeId = useThemeStore((state) => state.currentThemeId)
  const setTheme = useThemeStore((state) => state.setTheme)
  const fontFamily = useThemeStore((state) => state.fontFamily)
  const setFontFamily = useThemeStore((state) => state.setFontFamily)
  const isAdminAuthenticated = useAdminStore((state) => state.isAuthenticated)

  // Показывать только админу
  if (!isAdminAuthenticated) {
    return null
  }

  return (
    <div
      className="fixed z-2000 sm:bottom-6 sm:left-6"
      style={{
        bottom: '1rem',
        left: '1rem',
        maxWidth: 'calc(100vw - 2rem)',
        right: 'auto'
      }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="theme-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mb-3 w-full max-w-[340px] rounded-3xl border p-4 shadow-2xl shadow-black/10 backdrop-blur-2xl sm:mb-4 sm:p-5"
            style={{
              maxHeight: 'calc(100vh - 8rem)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.9))',
              borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.5))',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-neutral-400">Дизайн</p>
                <h4 className="text-lg font-display text-neutral-900">Выбор оформления</h4>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-neutral-400 transition hover:text-primary-600 backdrop-blur-sm"
                style={{
                  background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.8))',
                  borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
                }}
                aria-label="Закрыть панель тем"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-neutral-400">Пресеты</p>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {themePresets.map((preset) => {
                    const isActive = preset.id === currentThemeId
                    return (
                      <button
                        key={preset.id}
                        onClick={() => setTheme(preset.id)}
                        className={`group flex h-24 sm:h-28 flex-col justify-between overflow-hidden rounded-2xl border p-2 sm:p-3 text-left transition-all duration-300 ${
                          isActive
                            ? 'border-primary-400 shadow-[0_18px_40px_-25px_rgba(79,143,127,0.45)]'
                            : 'border-white/70 hover:border-primary-200 hover:shadow-[0_18px_40px_-28px_rgba(79,143,127,0.35)]'
                        }`}
                        style={{ background: preset.preview }}
                      >
                        <span
                          className="rounded-full px-2 py-0.5 sm:px-3 sm:py-1 text-[0.6rem] sm:text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-neutral-600 backdrop-blur-sm"
                          style={{
                            background: 'var(--theme-chip-bg, rgba(255,255,255,0.85))',
                          }}
                        >
                          {preset.name}
                        </span>
                        <span className="line-clamp-2 text-[0.7rem] sm:text-xs font-medium text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]">
                          {preset.description}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Эффекты отключены */}
              {/*
              <div
                className="rounded-2xl border p-4 backdrop-blur-md"
                style={{
                  background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.85))',
                  borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-neutral-500" />
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-neutral-400">
                    Эффекты
                  </p>
                </div>
                <div className="space-y-3">
                  {effectOptions.map((effect) => {
                    const active = effects[effect.id]
                    return (
                      <button
                        key={effect.id}
                        onClick={() => toggleEffect(effect.id)}
                        className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-2 text-left transition backdrop-blur-sm ${
                          active
                            ? 'border-primary-300 bg-primary-50/70 text-primary-700'
                            : 'text-neutral-500 hover:border-primary-200/70 hover:text-primary-600'
                        }`}
                        style={!active ? {
                          background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.8))',
                          borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
                        } : undefined}
                      >
                        <span className={`mt-1 inline-flex h-3 w-3 rounded-full ${active ? 'bg-primary-600 shadow-[0_0_0_4px_rgba(79,143,127,0.25)]' : 'bg-neutral-300'}`} />
                        <span>
                          <p className="text-sm font-semibold leading-tight">{effect.label}</p>
                          <p className="text-xs leading-snug opacity-80">{effect.description}</p>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              */}

              <div
                className="rounded-2xl border p-4 backdrop-blur-md"
                style={{
                  background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.85))',
                  borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Paintbrush size={16} className="text-neutral-500" />
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-neutral-400">
                    Шрифты
                  </p>
                </div>
                <div className="space-y-2">
                  {fontOptions.map((font) => {
                    const isActive = font.id === fontFamily
                    return (
                      <button
                        key={font.id}
                        onClick={() => setFontFamily(font.id)}
                        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition backdrop-blur-sm ${
                          isActive
                            ? 'border-primary-300 bg-primary-50/70 text-primary-700'
                            : 'text-neutral-500 hover:border-primary-200/70 hover:text-primary-600'
                        }`}
                        style={!isActive ? {
                          background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.8))',
                          borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
                        } : undefined}
                      >
                        <span className={`mt-1 inline-flex h-3 w-3 rounded-full ${isActive ? 'bg-primary-600 shadow-[0_0_0_4px_rgba(79,143,127,0.25)]' : 'bg-neutral-300'}`} />
                        <span>
                          <p className="text-sm font-semibold leading-tight">{font.label}</p>
                          <p className="text-xs leading-snug opacity-70">{font.display} / {font.body}</p>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="group inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border shadow-xl shadow-primary-500/20 backdrop-blur-xl transition hover:scale-105"
        style={{
          background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.8))',
          borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.65))',
        }}
        aria-label="Переключить панель тем"
      >
        <span className="relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-500/25 via-white/40 to-accent-400/35">
          {isOpen ? (
            <X size={18} className="text-primary-700 sm:w-5 sm:h-5" />
          ) : (
            <Paintbrush size={18} className="text-primary-700 sm:w-5 sm:h-5" />
          )}
          <span className="absolute inset-0 rounded-full border border-white/70 opacity-70" />
        </span>
      </button>
    </div>
  )
}
