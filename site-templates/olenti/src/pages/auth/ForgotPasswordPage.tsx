import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { ROUTES } from '@constants/routes'
import { resolveSiteSettings } from '@constants/siteDefaults'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import { motion } from 'framer-motion'
import { ArrowLeft, Leaf, Mail } from 'lucide-react'
import React from 'react'
import { Link } from 'react-router-dom'

export const ForgotPasswordPage: React.FC = () => {
  const settings = resolveSiteSettings(useSiteSettingsStore((state) => state.siteSettings))
  const supportEmail = settings.contactEmail

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 mb-4">
              <Leaf className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-display font-semibold text-neutral-900">
              Восстановление пароля
            </h1>
            <p className="text-neutral-500 mt-2">
              Автоматическое восстановление пароля пока не настроено.
            </p>
          </div>

          <div className="space-y-4 text-sm text-neutral-600">
            <p>
              Если вы не можете войти, напишите нам и мы поможем восстановить доступ к аккаунту.
            </p>
            {supportEmail ? <p>Контакт для связи: {supportEmail}</p> : <p>Используйте email, который указывали при регистрации.</p>}
          </div>

          <Button fullWidth size="lg" className="mt-6 flex items-center justify-center gap-2">
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`} className="flex items-center justify-center gap-2 w-full h-full">
                <Mail size={18} />
                Написать в поддержку
              </a>
            ) : (
              <Link to={ROUTES.AUTH_LOGIN} className="flex items-center justify-center gap-2 w-full h-full">
                <Mail size={18} />
                Вернуться ко входу
              </Link>
            )}
          </Button>

          <div className="mt-6 text-center">
            <Link
              to={ROUTES.AUTH_LOGIN}
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              <ArrowLeft size={16} />
              Вернуться к входу
            </Link>
          </div>
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
