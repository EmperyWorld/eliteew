import React from 'react'

export interface AdminSectionCardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  accent?: boolean
}

const paddingClass: Record<NonNullable<AdminSectionCardProps['padding']>, string> = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4',
  lg: 'p-5 sm:p-6',
}

export const AdminSectionCard: React.FC<AdminSectionCardProps> = ({
  children,
  className = '',
  padding = 'md',
  accent = false,
}) => {
  return (
    <div
      className={`
        relative rounded-2xl border border-neutral-200/80 dark:border-slate-700/80
        bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-sm
        ${paddingClass[padding]}
        ${className}
      `}
    >
      {accent ? (
        <div className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-primary-400/40 to-transparent" />
      ) : null}
      {children}
    </div>
  )
}
