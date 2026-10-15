import React from 'react'
import clsx from 'clsx'
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

export interface AlertProps {
  type?: 'success' | 'error' | 'warning' | 'info'
  message: string
  className?: string
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  message,
  className,
}) => {
  const typeStyles = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  }

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }

  const Icon = icons[type]

  return (
    <div
      className={clsx(
        'flex items-center gap-2 p-4 rounded-lg border',
        typeStyles[type],
        className
      )}
    >
      <Icon size={20} />
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}
