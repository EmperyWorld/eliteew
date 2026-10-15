import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { Input } from '@components/atoms/Input'
import { ROUTES } from '@constants/routes'
import { useUserStore } from '@store/slices/userSlice'
import { motion } from 'framer-motion'
import { Leaf } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, error, login, clearError } = useUserStore()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  useEffect(() => {
    if (isAuthenticated) {
      navigate(ROUTES.ACCOUNT_PROFILE)
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    return () => clearError()
  }, [clearError])

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) {
      clearError()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const success = await login(formData.email.trim(), formData.password)
    if (success) {
      navigate(ROUTES.ACCOUNT_PROFILE)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-8 sm:py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary-100 mb-4">
              <Leaf className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-semibold text-neutral-900">
              Вход в личный кабинет
            </h1>
            <p className="text-neutral-500 mt-2">
              Используйте email и пароль, чтобы продолжить
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-neutral-700 mb-2">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label htmlFor="login-password" className="block text-sm font-medium text-neutral-700">
                  Пароль
                </label>
                <Link
                  to={ROUTES.AUTH_FORGOT_PASSWORD}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Нужна помощь?
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Введите пароль"
                required
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" fullWidth disabled={isLoading}>
              {isLoading ? 'Входим...' : 'Войти'}
            </Button>
          </form>

          <p className="text-center text-sm text-neutral-500 mt-6">
            Нет аккаунта?{' '}
            <Link to={ROUTES.AUTH_REGISTER} className="text-primary-600 hover:text-primary-700">
              Зарегистрироваться
            </Link>
          </p>
        </Card>

        <p className="text-center text-sm text-neutral-500 mt-6">
          <Link to={ROUTES.HOME} className="hover:text-primary-600">
            ← Вернуться на главную
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
