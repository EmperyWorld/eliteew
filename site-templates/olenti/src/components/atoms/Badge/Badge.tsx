import React from 'react'
import clsx from 'clsx'

export interface BadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className,
  style,
}) => {
  const variantStyles = {
    primary: 'theme-chip border px-3 shadow-[0_20px_45px_-32px_rgba(17,55,34,0.32)]',
    success: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30',
    warning: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg shadow-yellow-500/30',
    error: 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg shadow-red-500/30',
    info: 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg shadow-blue-500/30',
  }

  const inlineStyles: Partial<Record<NonNullable<BadgeProps['variant']>, React.CSSProperties>> = {
    primary: {
      background: 'var(--theme-chip-bg, rgba(255,255,255,0.82))',
      color: 'var(--theme-chip-text, #2f4e40)',
      borderColor: 'color-mix(in srgb, var(--theme-chip-text, #2f4e40) 18%, transparent)',
    },
  }

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs font-semibold rounded-full',
    md: 'px-3 py-1.5 text-sm font-bold rounded-full',
  }

  return (
    <span className={clsx(
      'inline-flex items-center justify-center',
      'backdrop-blur-sm',
      variantStyles[variant],
      sizeStyles[size],
      className
    )}
    style={{ ...(variant ? inlineStyles[variant] : {}), ...style }}>
      {children}
    </span>
  )
}
