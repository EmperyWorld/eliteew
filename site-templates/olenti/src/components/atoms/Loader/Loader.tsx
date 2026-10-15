import React from 'react'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

export interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const Loader: React.FC<LoaderProps> = ({ size = 'md', className }) => {
  const sizeStyles = {
    sm: 'w-5 h-5',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  }

  return (
    <div className="relative">
      <Loader2
        className={clsx(
          'animate-spin gradient-text',
          sizeStyles[size],
          className
        )}
      />
      <div className={clsx(
        'absolute inset-0 rounded-full bg-gradient-to-r from-primary-500/20 to-accent-500/20 blur-md animate-pulse',
        sizeStyles[size]
      )} />
    </div>
  )
}
