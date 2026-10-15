import React from 'react'
import clsx from 'clsx'

export interface TypographyProps {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span'
  className?: string
  children: React.ReactNode
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'p',
  className,
  children,
}) => {
  const variantStyles = {
    h1: 'text-4xl font-bold font-display',
    h2: 'text-3xl font-bold font-display',
    h3: 'text-2xl font-semibold font-display',
    h4: 'text-xl font-semibold',
    h5: 'text-lg font-semibold',
    h6: 'text-base font-semibold',
    p: 'text-base',
    span: 'text-base',
  }

  const Component = variant

  return (
    <Component className={clsx(variantStyles[variant], className)}>
      {children}
    </Component>
  )
}
