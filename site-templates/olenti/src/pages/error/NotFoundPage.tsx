import React from 'react'
import { ErrorLayout } from '@components/layouts/ErrorLayout'

export const NotFoundPage: React.FC = () => {
  return <ErrorLayout statusCode={404} message="Страница не найдена" />
}
