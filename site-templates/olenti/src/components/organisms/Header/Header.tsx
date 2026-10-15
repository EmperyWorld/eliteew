import { SearchBar } from '@components/molecules/SearchBar'
import { ROUTES } from '@constants/routes'
import { resolveSiteSettings } from '@constants/siteDefaults'
import { usePageContent } from '@hooks/usePageContent'
import { useCartStore } from '@store/slices/cartSlice'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import { useUserStore } from '@store/slices/userSlice'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Leaf, LogOut, Menu, ShoppingCart, User, X } from 'lucide-react'
import React, { memo, useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const HeaderComponent: React.FC = () => {
  const itemCount = useCartStore((state) => state.getItemCount())
  const { user, isAuthenticated, logout } = useUserStore()
  const settingsLoaded = useSiteSettingsStore((state) => state.settingsLoaded)
  const siteSettings = resolveSiteSettings(useSiteSettingsStore((state) => state.siteSettings))
  const { getBlock, isContentReady: layoutContentReady } = usePageContent('layout')
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const siteTitle = settingsLoaded ? siteSettings.siteTitle?.trim() || 'Сайт' : ''
  const siteSubtitle = layoutContentReady ? getBlock('header', 'tagline', '') : ''

  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname])

  const toggleMobileMenu = useCallback(() => setIsMobileMenuOpen(prev => !prev), [])
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), [])

  return (
    <header className="sticky top-0 z-50 pt-6 pb-4">
      <div className="container mx-auto px-2 sm:px-4 md:px-6">
        <div className="relative">
          <div className="absolute inset-0 hidden md:block">
            <div className="absolute inset-0 -z-10 rounded-3xl blur-3xl theme-glass-surface" />
          </div>
          <div className="glass rounded-3xl shadow-floating px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                to={ROUTES.HOME}
                className="group flex items-center gap-3 transition-transform duration-300 hover:scale-[1.02]"
              >
                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border shadow-[0_18px_35px_-20px_rgba(17,55,34,0.3)] backdrop-blur-md theme-glass-surface-strong theme-glass-border">
                  <span className="pointer-events-none absolute inset-0 rounded-2xl theme-glass-gradient" />
                  <Leaf
                    className="relative h-6 w-6 text-primary-700 drop-shadow-[0_4px_12px_rgba(17,41,35,0.18)]"
                    aria-hidden="true"
                  />
                </span>
                <span className="flex flex-col min-w-[8rem]">
                  {settingsLoaded ? (
                    <span className="text-3xl font-display font-semibold tracking-tight gradient-text">{siteTitle}</span>
                  ) : (
                    <span className="block h-9 w-36 animate-pulse rounded-lg bg-neutral-200/80" aria-hidden />
                  )}
                  {layoutContentReady && siteSubtitle ? (
                    <span className="hidden text-[0.65rem] uppercase tracking-[0.55em] text-neutral-500 sm:block">
                      {siteSubtitle}
                    </span>
                  ) : null}
                  {!layoutContentReady ? (
                    <span className="mt-1 hidden h-3 w-28 animate-pulse rounded bg-neutral-200/70 sm:block" aria-hidden />
                  ) : null}
                </span>
              </Link>
            </div>

            <nav className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-full border shadow-outline backdrop-blur-md theme-glass-surface theme-glass-border">
              <Link
                to={ROUTES.SHOP}
                className={clsx(
                  'px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300',
                  isActive(ROUTES.SHOP)
                    ? 'bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 shadow-primary-500/30 theme-nav-active'
                    : 'text-neutral-600 hover:text-primary-600 theme-nav-hover'
                )}
              >
                Магазин
              </Link>
              <Link
                to={ROUTES.CONSULTATIONS}
                className={clsx(
                  'px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300',
                  isActive(ROUTES.CONSULTATIONS)
                    ? 'bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 shadow-primary-500/30 theme-nav-active'
                    : 'text-neutral-600 hover:text-primary-600 theme-nav-hover'
                )}
              >
                Консультации
              </Link>
              <Link
                to={ROUTES.MASTERCLASSES}
                className={clsx(
                  'px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300',
                  isActive(ROUTES.MASTERCLASSES)
                    ? 'bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 shadow-primary-500/30 theme-nav-active'
                    : 'text-neutral-600 hover:text-primary-600 theme-nav-hover'
                )}
              >
                Мастер-классы
              </Link>
              <Link
                to={ROUTES.ABOUT}
                className={clsx(
                  'px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300',
                  isActive(ROUTES.ABOUT)
                    ? 'bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 shadow-primary-500/30 theme-nav-active'
                    : 'text-neutral-600 hover:text-primary-600 theme-nav-hover'
                )}
              >
                О нас
              </Link>
              <Link
                to={ROUTES.CONTACTS}
                className={clsx(
                  'px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300',
                  isActive(ROUTES.CONTACTS)
                    ? 'bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 shadow-primary-500/30 theme-nav-active'
                    : 'text-neutral-600 hover:text-primary-600 theme-nav-hover'
                )}
              >
                Контакты
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex w-64 xl:w-72">
                <SearchBar onSearch={(query: string) => navigate(`${ROUTES.SHOP}?q=${encodeURIComponent(query)}`)} />
              </div>
              {/* User button / auth */}
              {isAuthenticated ? (
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={() => navigate(ROUTES.ACCOUNT_PROFILE)}
                    className="flex items-center gap-2 rounded-2xl border px-3 py-2 transition-all duration-300 hover:scale-105 backdrop-blur-md theme-glass-surface theme-glass-border"
                  >
                    <User size={20} className="text-primary-700" />
                    <span className="text-sm font-medium text-neutral-700 max-w-24 truncate">
                      {user?.name?.split(' ')[0] || 'Профиль'}
                    </span>
                  </button>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1 rounded-2xl border px-3 py-2 text-xs font-medium text-neutral-600 hover:text-red-600 hover:border-red-200 transition-colors backdrop-blur-md theme-glass-surface theme-glass-border"
                  >
                    <LogOut size={16} />
                    Выйти
                  </button>
                </div>
              ) : (
                <Link
                  to={ROUTES.AUTH_LOGIN}
                  className="hidden sm:flex items-center gap-2 rounded-2xl border px-3 py-2 transition-all duration-300 hover:scale-105 backdrop-blur-md theme-glass-surface theme-glass-border"
                >
                  <User size={20} className="text-primary-700" />
                  <span className="text-sm font-medium text-neutral-700">Войти</span>
                </Link>
              )}
              <Link
                to={ROUTES.CART}
                className="relative group inline-flex items-center justify-center rounded-2xl border px-3 py-3 transition-all duration-300 hover:scale-105 backdrop-blur-md theme-glass-gradient theme-glass-border"
              >
                <ShoppingCart size={22} className="text-primary-700 group-hover:text-primary-900 transition-colors" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500 text-white text-xs font-bold shadow-lg shadow-primary-500/40">
                    {itemCount}
                  </span>
                )}
              </Link>
              <button
                className="lg:hidden inline-flex items-center justify-center rounded-2xl border p-3 text-neutral-600 transition-all duration-300 backdrop-blur-md theme-glass-surface theme-glass-border theme-nav-hover"
                onClick={toggleMobileMenu}
                aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden fixed inset-x-0 top-[100px] z-40"
          >
            <div className="container mx-auto px-4">
              <div className="rounded-2xl border backdrop-blur-xl shadow-xl overflow-hidden theme-glass-surface-strong theme-glass-border">
                <nav className="p-4 space-y-2">
                  <Link
                    to={ROUTES.SHOP}
                    onClick={closeMobileMenu}
                    className={clsx(
                      'block px-4 py-3 rounded-xl font-medium transition-colors',
                      isActive(ROUTES.SHOP)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    )}
                  >
                    Магазин
                  </Link>
                  <Link
                    to={ROUTES.CONSULTATIONS}
                    onClick={closeMobileMenu}
                    className={clsx(
                      'block px-4 py-3 rounded-xl font-medium transition-colors',
                      isActive(ROUTES.CONSULTATIONS)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    )}
                  >
                    Консультации
                  </Link>
                  <Link
                    to={ROUTES.MASTERCLASSES}
                    onClick={closeMobileMenu}
                    className={clsx(
                      'block px-4 py-3 rounded-xl font-medium transition-colors',
                      isActive(ROUTES.MASTERCLASSES)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    )}
                  >
                    Мастер-классы
                  </Link>
                  <Link
                    to={ROUTES.ABOUT}
                    onClick={closeMobileMenu}
                    className={clsx(
                      'block px-4 py-3 rounded-xl font-medium transition-colors',
                      isActive(ROUTES.ABOUT)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    )}
                  >
                    О нас
                  </Link>
                  <Link
                    to={ROUTES.CONTACTS}
                    onClick={closeMobileMenu}
                    className={clsx(
                      'block px-4 py-3 rounded-xl font-medium transition-colors',
                      isActive(ROUTES.CONTACTS)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    )}
                  >
                    Контакты
                  </Link>
                </nav>
                <div className="p-4 border-t border-neutral-200">
                  <SearchBar onSearch={(query: string) => navigate(`${ROUTES.SHOP}?q=${encodeURIComponent(query)}`)} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden fixed inset-0 bg-black/20 z-30"
            onClick={closeMobileMenu}
          />
        )}
      </AnimatePresence>
    </header>
  )
}

export const Header = memo(HeaderComponent)
