import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { Input } from '@components/atoms/Input'
import { ROUTES } from '@constants/routes'
import { useUserStore } from '@store/slices/userSlice'
import { motion } from 'framer-motion'
import { Leaf } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, error, register, clearError } = useUserStore()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [localError, setLocalError] = useState('')

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
    if (localError) {
      setLocalError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Пароли не совпадают')
      return
    }

    const success = await register(
      formData.name.trim(),
      formData.email.trim(),
      formData.password,
    )

    if (success) {
      navigate(ROUTES.ACCOUNT_PROFILE)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="p-8 text-center space-y-6">
          <div>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 mb-4">
              <Leaf className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-display font-semibold text-neutral-900">
              Создать аккаунт
            </h1>
            <p className="text-neutral-500 mt-2">
              Зарегистрируйтесь, чтобы оформлять заказы и управлять своими записями.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label htmlFor="register-name" className="block text-sm font-medium text-neutral-700 mb-2">
                Имя
              </label>
              <Input
                id="register-name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Как к вам обращаться"
                required
              />
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-neutral-700 mb-2">
                Email
              </label>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-neutral-700 mb-2">
                Пароль
              </label>
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Придумайте пароль"
                required
              />
            </div>

            <div>
              <label htmlFor="register-confirm-password" className="block text-sm font-medium text-neutral-700 mb-2">
                Подтвердите пароль
              </label>
              <Input
                id="register-confirm-password"
                type="password"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder="Повторите пароль"
                required
              />
            </div>

            {(localError || error) && (
              <p className="text-sm text-red-500">{localError || error}</p>
            )}

            <Button fullWidth size="lg" type="submit" disabled={isLoading}>
              {isLoading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
            </Button>
          </form>

          <p className="text-sm text-neutral-500">
            Уже есть аккаунт?{' '}
            <Link to={ROUTES.AUTH_LOGIN} className="text-primary-600 hover:underline font-medium">
              Войти
            </Link>
          </p>

          <p className="text-xs text-neutral-400">
            Продолжая, вы соглашаетесь с нашей{' '}
            <Link to="/privacy" className="text-primary-600 hover:underline">
              политикой конфиденциальности
            </Link>
            .
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
