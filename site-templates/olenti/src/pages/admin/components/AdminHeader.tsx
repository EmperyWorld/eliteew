import { ADMIN_ROUTES } from '@constants/adminRoutes'
import type { ThemeId } from '@constants/themePresets'
import { useAdminTheme, type AdminTheme } from '@hooks/useAdminTheme'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import { applyThemeVariables } from '@utils/themeUtils'
import { Bell, Calendar, ChevronRight, Globe, GraduationCap, Menu, MessageSquare, Monitor, Moon, Sparkles, Sun, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { AdminLink as Link } from './AdminLink'
import { useAdminNotifications } from '../hooks/useAdminNotifications'
import { GlobalSearch } from './GlobalSearch'

interface AdminHeaderProps {
  title: string
  onOpenSidebar: () => void
  showSidebarToggle?: boolean
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  title,
  onOpenSidebar,
  showSidebarToggle = true,
}) => {
  const [showNotifications, setShowNotifications] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const { notifications, loading, error } = useAdminNotifications()
  const { theme, resolvedTheme, setTheme, initTheme } = useAdminTheme()
  const siteSettings = useSiteSettingsStore((state) => state.siteSettings)
  const settingsLoaded = useSiteSettingsStore((state) => state.settingsLoaded)
  const loadSettings = useSiteSettingsStore((state) => state.loadSettings)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef<HTMLDivElement>(null)

  // Initialize theme on mount
  useEffect(() => {
    initTheme()
  }, [initTheme])

  // Обновляем тему сайта при изменении настроек, если выбрана опция "Сайт"
  useEffect(() => {
    if (theme === 'site' && siteSettings?.defaultTheme) {
      const siteThemeId = siteSettings.defaultTheme as ThemeId
      console.log('[Theme] AdminHeader: Applying site theme:', siteThemeId)
      applyThemeVariables(siteThemeId)
    }
  }, [theme, siteSettings?.defaultTheme])

  // Загружаем настройки при монтировании, если они еще не загружены
  useEffect(() => {
    if (!settingsLoaded) {
      loadSettings().catch(() => undefined)
    }
  }, [loadSettings, settingsLoaded])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const themeOptions: { value: AdminTheme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Светлая', icon: Sun },
    { value: 'dark', label: 'Тёмная', icon: Moon },
    { value: 'system', label: 'Системная', icon: Monitor },
    { value: 'site', label: 'Сайт', icon: Globe },
  ]

  const handleThemeChange = async (newTheme: AdminTheme) => {
    await setTheme(newTheme)
    setShowThemeMenu(false)
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Доброе утро'
    if (hour < 18) return 'Добрый день'
    return 'Добрый вечер'
  }

  return (
    <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-neutral-200/50 dark:border-slate-700/50 px-4 lg:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 gap-4 transition-all duration-300 shadow-sm">
      <div className="flex items-center gap-4 shrink-0">
        {showSidebarToggle && (
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-2.5 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            aria-label="Открыть меню"
          >
            <Menu size={20} className="text-neutral-600 dark:text-slate-300" />
          </button>
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-white whitespace-nowrap bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              {title}
            </h1>
            <Sparkles size={14} className="text-amber-400 animate-pulse" />
          </div>
          <p className="text-xs text-neutral-500 dark:text-slate-400 hidden sm:flex items-center gap-1.5 mt-0.5">
            <Calendar size={12} className="text-primary-500 dark:text-primary-400" />
            <span className="font-medium">{getGreeting()}</span>
            <span>•</span>
            <span>{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </p>
        </div>
      </div>

      <div className="flex-1 max-w-lg hidden md:block">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Theme Toggle */}
        <div className="relative" ref={themeRef}>
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className={`p-2.5 rounded-xl transition-all duration-200 relative ${
              showThemeMenu
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 scale-105 shadow-md'
                : 'hover:bg-neutral-100 text-neutral-600 dark:hover:bg-slate-700 dark:text-slate-300 hover:scale-105 active:scale-95'
            }`}
            aria-label="Переключить тему"
          >
            {resolvedTheme === 'dark' ? (
              <Moon size={20} className="transition-transform duration-300" />
            ) : (
              <Sun size={20} className="transition-transform duration-300" />
            )}
          </button>

          {/* Theme Dropdown */}
          {showThemeMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-neutral-200/80 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-1.5 space-y-0.5">
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  const isActive = theme === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleThemeChange(option.value)}
                      aria-label={`Выбрать тему ${option.label}`}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 shadow-sm scale-[1.02]'
                          : 'text-neutral-700 hover:bg-neutral-100 dark:text-slate-300 dark:hover:bg-slate-700 hover:scale-[1.01]'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-primary-600 dark:text-primary-400' : ''} />
                      <span className="flex-1 text-left">{option.label}</span>
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 shadow-sm shadow-primary-500/50 animate-pulse" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            className={`relative p-2.5 rounded-xl transition-all duration-200 ${
              showNotifications
                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 scale-105 shadow-md'
                : 'hover:bg-neutral-100 text-neutral-600 dark:hover:bg-slate-700 dark:text-slate-300 hover:scale-105 active:scale-95'
            }`}
            aria-label="Уведомления"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} className={showNotifications ? 'animate-pulse' : ''} />
            {notifications.length > 0 && (
              <span
                className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse shadow-lg shadow-red-500/50"
                aria-label={`${notifications.length} новых уведомлений`}
              />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-200/80 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-neutral-100 dark:border-slate-700 bg-gradient-to-r from-primary-50/60 dark:from-primary-900/30 to-transparent">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-900/40">
                      <Bell size={14} className="text-primary-600 dark:text-primary-400" />
                    </div>
                    Уведомления
                  </h3>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
                    aria-label="Закрыть уведомления"
                  >
                    <X size={14} className="text-neutral-400" />
                  </button>
                </div>
                {notifications.length > 0 && (
                  <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2 font-medium">
                    {notifications.length} {notifications.length === 1 ? 'новое уведомление' : 'новых уведомлений'}
                  </p>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {loading && (
                  <div className="p-6 text-center">
                    <div className="w-6 h-6 border-2 border-primary-200 dark:border-primary-800 border-t-primary-500 rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-neutral-500 dark:text-slate-400 mt-2">Загрузка...</p>
                  </div>
                )}
                {!loading && error && (
                  <p className="p-4 text-sm text-red-600 text-center bg-red-50 dark:bg-red-900/20">{error}</p>
                )}
                {!loading && !error && notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <Bell size={32} className="mx-auto text-neutral-200 dark:text-slate-600 mb-2" />
                    <p className="text-sm text-neutral-500 dark:text-slate-400">Нет новых уведомлений</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <Link
                      key={n.id}
                      to={ADMIN_ROUTES.BOOKINGS}
                      className="flex items-start gap-3 p-3.5 hover:bg-neutral-50 dark:hover:bg-slate-700/50 border-b border-neutral-50 dark:border-slate-700/50 last:border-0 transition-all duration-200 group hover:scale-[1.01]"
                      onClick={() => setShowNotifications(false)}
                    >
                      <div className={`p-2 rounded-lg shrink-0 transition-all duration-200 group-hover:scale-110 ${
                        n.type === 'consultation'
                          ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50'
                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50'
                      }`}>
                        {n.type === 'consultation' ? <MessageSquare size={14} /> : <GraduationCap size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{n.title}</p>
                        <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">{n.time}</p>
                      </div>
                      <ChevronRight size={14} className="text-neutral-300 dark:text-slate-500 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-all duration-200 shrink-0 mt-1 group-hover:translate-x-0.5" />
                    </Link>
                  ))
                )}
              </div>
              <Link
                to={ADMIN_ROUTES.BOOKINGS}
                className="flex items-center justify-center gap-1 p-3 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-t border-neutral-100 dark:border-slate-700 transition-colors"
                onClick={() => setShowNotifications(false)}
              >
                Все записи
                <ChevronRight size={14} />
              </Link>
            </div>
          )}
        </div>

        {/* User profile */}
        <div className="hidden sm:flex items-center gap-3 ml-1 pl-3 border-l border-neutral-200 dark:border-slate-700">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all duration-300 hover:scale-110 cursor-pointer">
            A
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">Admin</p>
            <p className="text-xs text-neutral-500 dark:text-slate-400 font-medium">Администратор</p>
          </div>
        </div>
      </div>
    </header>
  )
}
