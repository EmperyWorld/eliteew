import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@components/atoms/Button'
import { ROUTES } from '@constants/routes'

export const ErrorLayout: React.FC<{ statusCode?: number; message?: string }> = ({
  statusCode = 404,
  message,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">{statusCode}</h1>
        <p className="text-xl text-gray-600 mb-8">
          {message || 'Страница не найдена'}
        </p>
        <Link to={ROUTES.HOME}>
          <Button>Вернуться на главную</Button>
        </Link>
      </div>
    </div>
  )
}
