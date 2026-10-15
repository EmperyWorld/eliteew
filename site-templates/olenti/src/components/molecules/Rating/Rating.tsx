import React from 'react'
import clsx from 'clsx'

export interface RatingProps {
  average: number
  count: number
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
  className?: string
}

export const Rating: React.FC<RatingProps> = ({
  average,
  count,
  size = 'md',
  showCount = true,
  className,
}) => {
  const sizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const starSizeStyles = {
    sm: 14,
    md: 18,
    lg: 22,
  }

  return (
    <div className={clsx('flex items-center gap-1', className)}>
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={clsx(
              star <= Math.round(average) ? 'text-yellow-400' : 'text-gray-300'
            )}
            style={{ fontSize: `${starSizeStyles[size]}px` }}
          >
            ★
          </span>
        ))}
      </div>
      <span className={clsx('font-medium text-gray-700', sizeStyles[size])}>
        {average.toFixed(1)}
      </span>
      {showCount && (
        <span className={clsx('text-gray-500', sizeStyles[size])}>
          ({count})
        </span>
      )}
    </div>
  )
}
