import React from 'react'
import { Navigate } from 'react-router-dom'
import { ROUTES } from '@constants/routes'

// Настройки профиля больше не используются, делаем безопасный редирект
export const SettingsPage: React.FC = () => {
  return <Navigate to={ROUTES.ACCOUNT_PROFILE} replace />
}
