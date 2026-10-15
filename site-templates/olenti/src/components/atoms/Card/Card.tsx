import React from 'react'
import clsx from 'clsx'

export interface CardProps {
  className?: string
  children: React.ReactNode
  shadow?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: () => void
  variant?: 'glass' | 'solid'
  style?: React.CSSProperties
}

export const Card: React.FC<CardProps> = ({
  className,
  children,
  shadow = 'md',
  hover = false,
  onClick,
  variant = 'glass',
  style,
}) => {
  const shadowStyles: Record<NonNullable<CardProps['shadow']>, string> = {
    none: '',
    sm: 'shadow-[0_18px_45px_-30px_rgba(17,55,34,0.25)] dark:shadow-[0_18px_45px_-30px_rgba(0,0,0,0.4)]',
    md: 'shadow-[var(--theme-card-shadow,0_30px_80px_-45px_rgba(17,55,34,0.28))] dark:shadow-[0_30px_80px_-45px_rgba(0,0,0,0.5)]',
    lg: 'shadow-[0_55px_130px_-45px_rgba(17,55,34,0.32)] dark:shadow-[0_55px_130px_-45px_rgba(0,0,0,0.6)]',
  }

  const variantStyles: Record<NonNullable<CardProps['variant']>, string> = {
    glass: 'glass dark:bg-slate-800/80 dark:border-slate-700/50 dark:backdrop-blur-xl',
    solid:
      'border border-[color:var(--theme-card-border,rgba(255,255,255,0.55))] bg-[color:var(--theme-card-surface,rgba(255,255,255,0.92))] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/90',
  }

  const hoverStyles: Record<NonNullable<CardProps['variant']>, string> = {
    glass: 'hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_35px_100px_-50px_rgba(79,143,127,0.35)] dark:hover:shadow-[0_35px_100px_-50px_rgba(79,143,127,0.2)]',
    solid: 'hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-[0_35px_90px_-45px_rgba(79,143,127,0.28)] dark:hover:shadow-[0_35px_90px_-45px_rgba(79,143,127,0.15)]',
  }

  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-2xl p-6 transition-all duration-300',
        variant ? variantStyles[variant] : '',
        shadow ? shadowStyles[shadow] : '',
        hover && variant ? hoverStyles[variant] : '',
        onClick && 'cursor-pointer',
        className
      )}
      style={style}
    >
      {children}
    </div>
  )
}
