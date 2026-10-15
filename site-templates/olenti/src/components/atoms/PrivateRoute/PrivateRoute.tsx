import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useUserStore } from '@store/slices/userSlice'
import { ROUTES } from '@constants/routes'

interface PrivateRouteProps {
  children: React.ReactNode
  redirectTo?: string
}

/**
 * Компонент для защиты роутов, требующих авторизации
 * Перенаправляет на страницу входа если пользователь не авторизован
 */
export const PrivateRoute: React.FC<PrivateRouteProps> = ({
  children,
  redirectTo = ROUTES.AUTH_LOGIN,
}) => {
  const { isAuthenticated } = useUserStore()
  const location = useLocation()

  if (!isAuthenticated) {
    // Сохраняем текущий путь для редиректа после входа
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  return <>{children}</>
}
