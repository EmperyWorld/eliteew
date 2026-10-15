import { Button } from '@components/atoms/Button'
import { ROUTES } from '@constants/routes'
import { motion } from 'framer-motion'
import { ArrowRight, Leaf, Sparkles } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

export interface HeroContent {
  badge?: string
  headline_1?: string
  headline_2?: string
  lead?: string
  cta_shop?: string
  cta_consultation?: string
  card_label?: string
  card_title?: string
  card_description?: string
  card_notes?: string
  card_footer?: string
  badge_small_label?: string
  badge_small_text?: string
}

const EMPTY_HERO: Required<HeroContent> = {
  badge: '',
  headline_1: '',
  headline_2: '',
  lead: '',
  cta_shop: '',
  cta_consultation: '',
  card_label: '',
  card_title: '',
  card_description: '',
  card_notes: '',
  card_footer: '',
  badge_small_label: '',
  badge_small_text: '',
}

/** Shown only when CMS returned no hero copy (fresh instance). */
const PLACEHOLDER_HERO: Required<HeroContent> = {
  ...EMPTY_HERO,
  headline_1: 'Добро пожаловать',
  lead: 'Контент главной страницы настраивается в админ-панели.',
  cta_shop: 'Каталог',
  cta_consultation: 'Связаться',
}

function mergeHero(content?: HeroContent | null): Required<HeroContent> {
  const merged: Required<HeroContent> = { ...EMPTY_HERO, ...(content ?? {}) }
  const hasCopy =
    Boolean(merged.headline_1?.trim()) ||
    Boolean(merged.headline_2?.trim()) ||
    Boolean(merged.lead?.trim())
  if (!hasCopy) {
    return PLACEHOLDER_HERO
  }
  return merged
}

interface HeroSectionProps {
  content?: HeroContent | null
}

export const HeroSection: React.FC<HeroSectionProps> = ({ content }) => {
  const navigate = useNavigate()
  const c = mergeHero(content)
  const notes = (c.card_notes || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <section className="relative overflow-hidden pt-20 pb-24 sm:pt-24 sm:pb-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-[-10%] top-[-20%] h-[55vh] bg-gradient-to-b from-primary-200/35 via-transparent to-transparent blur-3xl" />
        <div className="absolute inset-x-[-15%] bottom-[-35%] h-[60vh] bg-gradient-to-t from-accent-200/30 via-transparent to-transparent blur-3xl" />
        <div className="absolute left-[12%] top-[18%] h-64 w-64 rounded-full bg-primary-300/25 blur-3xl" />
        <div className="absolute right-[14%] bottom-[12%] h-72 w-72 rounded-full bg-accent-300/20 blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
          <div className="space-y-8 sm:space-y-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
              {c.badge ? (
                <div
                  className="inline-flex items-center gap-3 rounded-full border px-5 py-2 shadow-outline backdrop-blur-md"
                  style={{
                    background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.55))',
                    borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.55))',
                  }}
                >
                  <Sparkles className="h-4 w-4 text-primary-600" />
                  <span className="text-xs font-semibold uppercase tracking-[0.5em] text-primary-700">{c.badge}</span>
                </div>
              ) : null}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.15, ease: 'easeOut' }}
              className="text-balance text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-display leading-[1.05]"
            >
              {c.headline_1 ? <span className="gradient-text">{c.headline_1}</span> : null}
              {c.headline_1 && c.headline_2 ? <br /> : null}
              {c.headline_2 ? <span className="text-neutral-900">{c.headline_2}</span> : null}
            </motion.h1>

            {c.lead ? (
              <motion.p
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, delay: 0.3, ease: 'easeOut' }}
                className="max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg lg:text-xl"
              >
                {c.lead}
              </motion.p>
            ) : null}

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease: 'easeOut' }}
              className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center"
            >
              {c.cta_shop ? (
                <Button
                  size="lg"
                  onClick={() => navigate(ROUTES.SHOP)}
                  className="group relative w-full overflow-hidden bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 text-white shadow-floating transition-all duration-300 hover:scale-105 sm:w-auto"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {c.cta_shop}
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </span>
                  <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-[120%]" />
                </Button>
              ) : null}

              {c.cta_consultation ? (
                <Button variant="outline" size="lg" onClick={() => navigate(ROUTES.CONSULTATIONS)} className="group w-full sm:w-auto">
                  {c.cta_consultation}
                </Button>
              ) : null}
            </motion.div>
          </div>

          <div className="relative hidden h-full lg:block">
            <motion.div
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.35, ease: 'easeOut' }}
            >
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative w-full max-w-full sm:max-w-[380px] rounded-[32px] border p-6 sm:p-8 shadow-floating backdrop-blur-2xl"
                style={{
                  background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.7))',
                  borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.55))',
                }}
              >
                <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-primary-500/15 via-transparent to-accent-400/15 opacity-90" />
                <div className="relative space-y-6">
                  {c.card_label ? (
                    <span className="text-xs font-semibold uppercase tracking-[0.45em] text-neutral-500">{c.card_label}</span>
                  ) : null}
                  {c.card_title ? <h3 className="text-3xl font-display text-neutral-900">{c.card_title}</h3> : null}
                  {c.card_description ? (
                    <p className="text-sm leading-relaxed text-neutral-600">{c.card_description}</p>
                  ) : null}
                  <div className="flex items-center gap-5">
                    <div className="relative h-28 w-28">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-500/35 via-primary-400/18 to-accent-400/25" />
                      <div
                        className="relative flex h-full w-full items-center justify-center rounded-full border backdrop-blur-xl p-3"
                        style={{
                          background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.4))',
                          borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.6))',
                        }}
                      >
                        <Leaf
                          className="h-full w-full p-5 text-primary-700 opacity-90 drop-shadow-[0_4px_12px_rgba(17,41,35,0.2)]"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3">
                      {notes.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {notes.map((note) => (
                            <span
                              key={note}
                              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-neutral-600 backdrop-blur-sm"
                              style={{
                                background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.55))',
                                borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.6))',
                              }}
                            >
                              <span className="h-2 w-2 rounded-full bg-primary-500" />
                              {note}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {c.card_footer ? <p className="text-xs text-neutral-500">{c.card_footer}</p> : null}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {(c.badge_small_label || c.badge_small_text) && (
              <motion.div
                initial={{ opacity: 0, x: -40, y: -30 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8, ease: 'easeOut' }}
                className="absolute -top-10 -left-6 rounded-2xl border px-4 py-3 shadow-outline backdrop-blur-lg"
                style={{
                  background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.65))',
                  borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.6))',
                }}
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="h-8 w-8 text-primary-600" />
                  <div>
                    {c.badge_small_label ? (
                      <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">{c.badge_small_label}</p>
                    ) : null}
                    {c.badge_small_text ? <p className="text-sm font-semibold text-primary-700">{c.badge_small_text}</p> : null}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
