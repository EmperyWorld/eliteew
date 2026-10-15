import React from 'react'
import clsx from 'clsx'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}) => {
  const baseStyles = 'bg-neutral-200'

  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-xl',
  }

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%]',
    none: '',
  }

  // Build inline style only if width/height are provided
  const inlineStyle: React.CSSProperties | undefined =
    width || height
      ? {
          ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
          ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
        }
      : undefined

  return (
    <div
      className={clsx(
        baseStyles,
        variantStyles[variant],
        animationStyles[animation],
        className
      )}
      {...(inlineStyle && { style: inlineStyle })}
      aria-hidden="true"
    />
  )
}

// Готовые скелетоны для частых случаев
export const ProductCardSkeleton: React.FC = () => (
  <div className="rounded-3xl border border-white/50 bg-white/70 p-4 backdrop-blur-sm">
    <Skeleton variant="rounded" className="aspect-square w-full mb-4" />
    <Skeleton variant="text" className="h-4 w-3/4 mb-2" />
    <Skeleton variant="text" className="h-3 w-full mb-2" />
    <Skeleton variant="text" className="h-3 w-2/3 mb-4" />
    <div className="flex items-center justify-between">
      <Skeleton variant="text" className="h-6 w-20" />
      <Skeleton variant="rounded" className="h-10 w-10" />
    </div>
  </div>
)

export const ConsultationCardSkeleton: React.FC = () => (
  <div className="rounded-3xl border border-white/50 bg-white/70 p-6 backdrop-blur-sm">
    <Skeleton variant="rounded" className="h-6 w-24 mb-4" />
    <Skeleton variant="text" className="h-6 w-3/4 mb-3" />
    <Skeleton variant="text" className="h-4 w-full mb-2" />
    <Skeleton variant="text" className="h-4 w-5/6 mb-4" />
    <div className="flex items-center gap-4">
      <Skeleton variant="text" className="h-4 w-20" />
      <Skeleton variant="text" className="h-4 w-16" />
    </div>
  </div>
)

export const ProfileSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton variant="circular" className="w-20 h-20" />
      <div className="flex-1">
        <Skeleton variant="text" className="h-6 w-40 mb-2" />
        <Skeleton variant="text" className="h-4 w-32" />
      </div>
    </div>
    <div className="space-y-3">
      <Skeleton variant="rounded" className="h-12 w-full" />
      <Skeleton variant="rounded" className="h-12 w-full" />
      <Skeleton variant="rounded" className="h-12 w-full" />
    </div>
  </div>
)

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <div className="flex items-center gap-4 p-4 border-b border-neutral-100">
    {Array.from({ length: columns }).map((_, i) => (
      <Skeleton key={i} variant="text" className="h-4 flex-1" />
    ))}
  </div>
)
