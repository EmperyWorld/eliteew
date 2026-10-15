import React from 'react'
import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  fullWidth?: boolean
  children: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      className,
      disabled,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary: 'text-white shadow-floating',
      secondary: 'border shadow-outline backdrop-blur-md hover:shadow-[0_25px_55px_-35px_rgba(0,0,0,0.18)]',
      outline: 'border-2 backdrop-blur-md hover:shadow-[0_25px_50px_-35px_rgba(0,0,0,0.18)]',
      ghost: 'hover:bg-transparent',
      danger: 'text-white shadow-lg shadow-accent-500/40 hover:shadow-[0_35px_80px_-45px_rgba(208,140,44,0.5)]',
    }

    const variantInlineStyles: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
      primary: {
        background: 'var(--theme-button-primary-bg)',
        color: 'var(--theme-button-primary-text, #ffffff)',
        boxShadow: 'var(--theme-button-primary-shadow, var(--shadow-soft))',
      },
      secondary: {
        background: 'var(--theme-card-surface, rgba(255,255,255,0.9))',
        color: 'var(--theme-heading-color, #0a1714)',
        borderColor: 'var(--theme-card-border, rgba(255,255,255,0.55))',
      },
      outline: {
        background: 'var(--theme-button-outline-bg, rgba(255,255,255,0.72))',
        color: 'var(--theme-button-outline-text, #29584c)',
        borderColor: 'var(--theme-button-outline-border, rgba(79,143,127,0.45))',
      },
      ghost: {
        color: 'var(--theme-highlight, #4f8f7f)',
        background: 'transparent',
      },
      danger: {
        background: 'linear-gradient(120deg, #d86c4a 0%, #c04b2d 50%, #9d2f1c 100%)',
        color: '#ffffff',
      },
    }

    const sizeStyles = {
      sm: 'px-4 py-2.5 text-sm font-medium rounded-xl',
      md: 'px-6 py-3.5 text-base font-semibold rounded-2xl',
      lg: 'px-8 py-4 text-lg font-semibold rounded-3xl',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          'inline-flex items-center justify-center transition-all duration-300',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
          'active:scale-95 hover:scale-105',
          'focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-ring-color,rgba(79,143,127,0.22))] focus:ring-offset-2',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        data-variant={variant}
        style={{
          ...(variant ? variantInlineStyles[variant] : {}),
          ...style,
        }}
        onMouseEnter={(e) => {
          if (variant === 'outline' && !disabled && !isLoading) {
            e.currentTarget.style.background = 'var(--theme-button-outline-hover-bg, rgba(255,255,255,0.9))'
            e.currentTarget.style.borderColor = 'var(--theme-button-outline-hover-border, rgba(79,143,127,0.65))'
          }
        }}
        onMouseLeave={(e) => {
          if (variant === 'outline' && !disabled && !isLoading) {
            e.currentTarget.style.background = 'var(--theme-button-outline-bg, rgba(255,255,255,0.72))'
            e.currentTarget.style.borderColor = 'var(--theme-button-outline-border, rgba(79,143,127,0.45))'
          }
        }}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="inline-block animate-spin mr-2" size={16} />
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
