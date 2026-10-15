import { ToastContainer } from '@components/atoms/Toast'
import { ScrollToTop } from '@components/molecules/ScrollToTop'
import { Footer } from '@components/organisms/Footer'
import { Header } from '@components/organisms/Header'
import { ThemeOrchestrator, ThemeSwitcher } from '@components/organisms/ThemeSwitcher'
import { resolveSiteSettings } from '@constants/siteDefaults'
import { ensureSiteSettingsLoaded, useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import { motion } from 'framer-motion'
import React, { memo, useEffect, useMemo } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

// Мемоизированные компоненты для предотвращения лишних ререндеров
 const MemoizedHeader = memo(Header)
const MemoizedFooter = memo(Footer)
const MemoizedThemeSwitcher = memo(ThemeSwitcher)
const MemoizedScrollToTop = memo(ScrollToTop)
const MemoizedToastContainer = memo(ToastContainer)

export const MainLayout: React.FC = () => {
  const location = useLocation()
  const settingsLoaded = useSiteSettingsStore((s) => s.settingsLoaded)
  const siteTitle = resolveSiteSettings(useSiteSettingsStore((s) => s.siteSettings)).siteTitle?.trim()

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    if (!settingsLoaded) {
      return
    }
    if (siteTitle) {
      document.title = siteTitle
    }
  }, [settingsLoaded, siteTitle])

  // При входе в основной сайт принудительно сбрасываем admin-dark на светлую тему
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.classList.remove('dark')
      root.classList.add('light')
    }
  }, [])

  useEffect(() => {
    ensureSiteSettingsLoaded().catch(() => undefined)
  }, [])

  // Упрощённая анимация для лучшей производительности
  const pageTransition = useMemo(() => ({
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.2, ease: 'easeOut' as const }
  }), [])

  return (
    <div className="relative flex min-h-screen flex-col">
      <ThemeOrchestrator />
      <MemoizedHeader />
      <main className="relative z-10 grow w-full px-2 sm:px-4 md:px-6">
        <motion.div
          key={location.pathname}
          {...pageTransition}
          className="min-h-full"
        >
          <Outlet />
        </motion.div>
      </main>
      <MemoizedFooter />
      <MemoizedThemeSwitcher />
      <MemoizedScrollToTop />
      <MemoizedToastContainer />
    </div>
  )
}
