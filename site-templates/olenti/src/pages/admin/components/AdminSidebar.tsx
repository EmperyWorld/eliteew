import { ADMIN_ROUTES } from '@constants/adminRoutes'
import { useAdminStore } from '@store/slices/adminSlice'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import clsx from 'clsx'
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Leaf, LogOut, X } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AdminLink as Link } from './AdminLink'
import { navGroups } from '../config/navigation'

interface AdminSidebarProps {
  isOpen: boolean
  onClose: () => void
  embeddedMode?: boolean
}

const colorClasses: Record<string, { bg: string; text: string; activeBg: string; activeText: string; ring: string; darkBg: string; darkText: string; darkActiveBg: string; darkActiveText: string }> = {
  primary: { bg: 'bg-primary-100', text: 'text-primary-600', activeBg: 'bg-primary-100', activeText: 'text-primary-700', ring: 'ring-primary-200/50', darkBg: 'dark:bg-primary-900/30', darkText: 'dark:text-primary-400', darkActiveBg: 'dark:bg-primary-900/40', darkActiveText: 'dark:text-primary-300' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', activeBg: 'bg-emerald-100', activeText: 'text-emerald-700', ring: 'ring-emerald-200/50', darkBg: 'dark:bg-emerald-900/30', darkText: 'dark:text-emerald-400', darkActiveBg: 'dark:bg-emerald-900/40', darkActiveText: 'dark:text-emerald-300' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', activeBg: 'bg-orange-100', activeText: 'text-orange-700', ring: 'ring-orange-200/50', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-400', darkActiveBg: 'dark:bg-orange-900/40', darkActiveText: 'dark:text-orange-300' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', activeBg: 'bg-purple-100', activeText: 'text-purple-700', ring: 'ring-purple-200/50', darkBg: 'dark:bg-purple-900/30', darkText: 'dark:text-purple-400', darkActiveBg: 'dark:bg-purple-900/40', darkActiveText: 'dark:text-purple-300' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', activeBg: 'bg-blue-100', activeText: 'text-blue-700', ring: 'ring-blue-200/50', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-400', darkActiveBg: 'dark:bg-blue-900/40', darkActiveText: 'dark:text-blue-300' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-600', activeBg: 'bg-pink-100', activeText: 'text-pink-700', ring: 'ring-pink-200/50', darkBg: 'dark:bg-pink-900/30', darkText: 'dark:text-pink-400', darkActiveBg: 'dark:bg-pink-900/40', darkActiveText: 'dark:text-pink-300' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', activeBg: 'bg-amber-100', activeText: 'text-amber-700', ring: 'ring-amber-200/50', darkBg: 'dark:bg-amber-900/30', darkText: 'dark:text-amber-400', darkActiveBg: 'dark:bg-amber-900/40', darkActiveText: 'dark:text-amber-300' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-600', activeBg: 'bg-violet-100', activeText: 'text-violet-700', ring: 'ring-violet-200/50', darkBg: 'dark:bg-violet-900/30', darkText: 'dark:text-violet-400', darkActiveBg: 'dark:bg-violet-900/40', darkActiveText: 'dark:text-violet-300' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', activeBg: 'bg-cyan-100', activeText: 'text-cyan-700', ring: 'ring-cyan-200/50', darkBg: 'dark:bg-cyan-900/30', darkText: 'dark:text-cyan-400', darkActiveBg: 'dark:bg-cyan-900/40', darkActiveText: 'dark:text-cyan-300' },
  neutral: { bg: 'bg-neutral-100', text: 'text-neutral-600', activeBg: 'bg-neutral-200', activeText: 'text-neutral-800', ring: 'ring-neutral-200/50', darkBg: 'dark:bg-slate-700/50', darkText: 'dark:text-slate-400', darkActiveBg: 'dark:bg-slate-700', darkActiveText: 'dark:text-slate-200' },
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isOpen,
  onClose,
  embeddedMode = false,
}) => {
  const location = useLocation()
  const { logout } = useAdminStore()
  const siteTitle = useSiteSettingsStore((state) => state.siteSettings.siteTitle)?.trim() || 'Студия'
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState(() => (embeddedMode ? false : true))

  const isActive = useCallback((path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }, [location.pathname])

  const toggleGroup = (groupTitle: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupTitle)) {
        next.delete(groupTitle)
      } else {
        next.add(groupTitle)
      }
      return next
    })
  }

  // Auto-expand groups with active items
  useEffect(() => {
    navGroups.forEach((group) => {
      const hasActive = group.items.some((item) => isActive(item.to, item.exact))
      if (hasActive) {
        setCollapsedGroups((prev) => {
          const next = new Set(prev)
          next.delete(group.title)
          return next
        })
      }
    })
  }, [isActive])

  useEffect(() => {
    if (embeddedMode) {
      setCollapsed(false)
    }
  }, [embeddedMode])

  const handleClose = () => {
    if (!embeddedMode) {
      onClose()
    }
  }

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {!embeddedMode && isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          embeddedMode
            ? 'relative h-full shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-neutral-200/80 dark:border-slate-700/80 flex flex-col translate-x-0 shadow-none'
            : 'fixed lg:static inset-y-0 left-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-neutral-200/80 dark:border-slate-700/80 flex flex-col transform transition-all duration-300 ease-out lg:translate-x-0 shadow-xl lg:shadow-none',
          !embeddedMode && (isOpen ? 'translate-x-0' : '-translate-x-full'),
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        {/* Logo Header */}
        <div className="p-5 border-b border-neutral-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <Link
              to={embeddedMode ? ADMIN_ROUTES.ROOT : '/'}
              className={clsx(
                'flex items-center group transition-all duration-200',
                collapsed ? 'justify-center w-full' : 'gap-3',
              )}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 group-hover:scale-105 transition-all duration-300">
                <Leaf className="h-5 w-5 text-white" />
              </span>
              {!collapsed && (
                <div>
                  <span className="text-xl font-display font-bold bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    {siteTitle}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-neutral-400 uppercase tracking-wider font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Админ-панель</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[9px] text-neutral-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary-50/80 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 border border-primary-100/70 dark:border-primary-800/60 font-semibold">
                        <span className="uppercase tracking-[0.16em]">Пакет</span>
                        <span>Pro</span>
                        <span className="text-xs leading-none">∞</span>
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-50/80 dark:bg-emerald-900/30 border border-emerald-100/80 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-medium">
                        <span className="text-[10px] tracking-[0.16em] uppercase">Сопровождение</span>
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </Link>
            <div className="flex items-center gap-1">
              {!embeddedMode && (
                <button
                  onClick={handleClose}
                  className="lg:hidden p-2 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  aria-label="Закрыть меню"
                >
                  <X size={20} className="text-neutral-500 dark:text-slate-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto scrollbar-thin">
          {/* Sidebar collapse/expand toggle */}
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className={clsx(
              'w-full mb-3 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide border transition-all duration-200',
              'bg-neutral-50/90 hover:bg-neutral-100 border-neutral-200 text-neutral-700 shadow-sm',
              'dark:bg-slate-800/80 dark:hover:bg-slate-700 border dark:border-slate-700 dark:text-slate-100',
            )}
            aria-label={collapsed ? 'Развернуть панель навигации' : 'Свернуть панель навигации'}
          >
            <ChevronLeft
              size={16}
              className={clsx(
                'transition-transform text-neutral-600 dark:text-slate-300',
                collapsed && 'rotate-180',
              )}
            />
            {!collapsed && <span>{collapsed ? 'Развернуть панель' : 'Свернуть панель'}</span>}
          </button>

          {navGroups.map((group) => {
            const GroupIcon = group.icon
            const isCollapsed = collapsedGroups.has(group.title)
            const hasActive = group.items.some((item) => isActive(item.to, item.exact))

            return (
              <div key={group.title} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.title)}
                  className={clsx(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-200',
                    hasActive
                      ? 'text-neutral-700 dark:text-slate-300 bg-neutral-100/50 dark:bg-slate-800/50'
                      : 'text-neutral-400 dark:text-slate-500 hover:text-neutral-600 dark:hover:text-slate-400 hover:bg-neutral-50/50 dark:hover:bg-slate-800/30',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <GroupIcon
                      size={12}
                      className={group.color || 'text-neutral-400 dark:text-slate-500'}
                    />
                    {!collapsed && <span>{group.title}</span>}
                  </div>
                  {!collapsed && (
                    <ChevronDown
                      size={12}
                      className={clsx(
                        'transition-transform duration-200',
                        isCollapsed ? 'rotate-[-90deg]' : 'rotate-0',
                      )}
                    />
                  )}
                </button>
                <div
                  className={clsx(
                    'space-y-1 overflow-hidden transition-all duration-300 ease-in-out',
                    isCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100',
                  )}
                >
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.to, item.exact)
                    const colors = colorClasses[item.color || 'primary']

                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={handleClose}
                        className={clsx(
                          'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative',
                          active
                            ? `${colors.activeBg} ${colors.darkActiveBg} ${colors.activeText} ${colors.darkActiveText} shadow-sm ring-1 ${colors.ring} scale-[1.02]`
                            : 'text-neutral-600 dark:text-slate-400 hover:bg-neutral-50 dark:hover:bg-slate-800 hover:text-neutral-900 dark:hover:text-white hover:scale-[1.01]',
                          collapsed && 'justify-center px-2',
                        )}
                        aria-current={active ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                      >
                        {active && !collapsed && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-primary-500 to-primary-600 dark:from-primary-400 dark:to-primary-500 rounded-r-full" />
                        )}
                        <span className={clsx(
                          'p-1.5 rounded-lg transition-all duration-200',
                          active
                            ? `${colors.bg} ${colors.darkBg} scale-110`
                            : 'bg-neutral-100 dark:bg-slate-800 group-hover:bg-neutral-200 dark:group-hover:bg-slate-700 group-hover:scale-105'
                        )}>
                          <Icon
                            size={16}
                            className={clsx(
                              'transition-all duration-200',
                              active
                                ? `${colors.text} ${colors.darkText}`
                                : 'text-neutral-500 dark:text-slate-400 group-hover:text-neutral-700 dark:group-hover:text-slate-200'
                            )}
                          />
                        </span>
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.label}</span>
                            {item.badge && (
                              <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30 ring-2 ring-red-200 dark:ring-red-800">
                                !
                              </span>
                            )}
                            {active && (
                              <ChevronRight
                                size={14}
                                className={clsx(
                                  `${colors.text} ${colors.darkText} transition-transform duration-200`,
                                  'group-hover:translate-x-0.5',
                                )}
                              />
                            )}
                          </>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-100 dark:border-slate-800 bg-gradient-to-t from-neutral-50/80 dark:from-slate-800/80 to-transparent backdrop-blur-sm space-y-2">
          <Link
            to="/"
            target="_blank"
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-neutral-700 dark:hover:text-white transition-all duration-200 w-full group hover:shadow-sm',
              collapsed && 'justify-center',
            )}
          >
            <span className="p-1.5 rounded-lg bg-neutral-100 dark:bg-slate-800 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
              <ExternalLink size={16} className="group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
            </span>
            {!collapsed && (
              <>
                <span className="flex-1">Открыть сайт</span>
                <ChevronRight
                  size={14}
                  className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                />
              </>
            )}
          </Link>
          <button
            onClick={logout}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 w-full group hover:shadow-sm',
              collapsed && 'justify-center',
            )}
          >
            <span className="p-1.5 rounded-lg bg-neutral-100 dark:bg-slate-800 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-all duration-200 group-hover:scale-110">
              <LogOut size={16} className="group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
            </span>
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Выйти из панели</span>
                <ChevronRight
                  size={14}
                  className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                />
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
