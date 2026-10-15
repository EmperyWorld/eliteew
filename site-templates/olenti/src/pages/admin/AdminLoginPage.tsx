import { Button } from '@components/atoms/Button'
import { Input } from '@components/atoms/Input'
import { ADMIN_ROUTES } from '@constants/adminRoutes'
import { useAdminStore } from '@store/slices/adminSlice'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import { AlertCircle, ArrowLeft, Leaf, Loader2, Lock } from 'lucide-react'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export const AdminLoginPage: React.FC = () => {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAdminStore()
  const siteTitle = useSiteSettingsStore((state) => state.siteSettings.siteTitle)?.trim() || 'Студия'

  // Если уже авторизован, редирект на дашборд
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(ADMIN_ROUTES.ROOT)
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const success = await login(password)
      if (success) {
        navigate(ADMIN_ROUTES.ROOT)
      } else {
        setError('Неверный пароль')
      }
    } catch {
      setError('Ошибка авторизации')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-1/3 -left-32 w-72 h-72 bg-purple-500/18 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute -bottom-40 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary-500/60 to-transparent opacity-60" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white/95 dark:bg-slate-950/90 backdrop-blur-2xl rounded-3xl shadow-[0_24px_80px_rgba(15,23,42,0.65)] border border-white/15 dark:border-slate-800/80 p-8 hover:shadow-[0_28px_90px_rgba(15,23,42,0.85)] transition-all duration-300">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 mb-4 shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60 hover:scale-110 transition-all duration-300">
              <Leaf className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              {siteTitle} Admin
            </h1>
            <div className="mt-2 space-y-1">
              <p className="text-neutral-500 dark:text-slate-400 text-sm font-medium">
                Отдельный контур управления сайтом
              </p>
              <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-neutral-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50/80 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 border border-primary-100/70 dark:border-primary-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="uppercase tracking-[0.16em]">Пакет</span>
                  <span>Pro</span>
                  <span className="text-xs leading-none">∞</span>
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50/80 dark:bg-emerald-900/30 border border-emerald-100/80 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300">
                  <span className="text-[10px] uppercase tracking-[0.16em]">Сопровождение</span>
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Hidden username for password managers */}
            <input
              type="text"
              name="username"
              value="admin"
              autoComplete="username"
              className="hidden"
              readOnly
              aria-label="Username"
            />

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 transition-colors duration-200" />
              <Input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                className="pl-12 py-3.5 bg-neutral-50/90 dark:bg-slate-900/80 border-neutral-200/70 dark:border-slate-700/80 focus:bg-white dark:focus:bg-slate-950 focus:border-primary-300 dark:focus:border-primary-500 focus:ring-2 focus:ring-primary-200/60 dark:focus:ring-primary-500/40 transition-all duration-200 placeholder:text-neutral-400 dark:placeholder:text-slate-500"
                autoComplete="current-password"
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3 border border-red-200 dark:border-red-800 animate-in slide-in-from-top-2 duration-200">
                <AlertCircle size={16} className="text-red-500 dark:text-red-400" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              disabled={isLoading || !password}
              className="py-3.5 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/45 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Вход...
                </>
              ) : (
                'Войти в панель'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <ArrowLeft size={14} />
              Вернуться на сайт
            </a>
          </div>
        </div>

        <p className="text-center mt-6 text-neutral-500 dark:text-slate-500 text-xs">
          © {new Date().getFullYear()} {siteTitle} • Admin access
        </p>
      </div>
    </div>
  )
}
