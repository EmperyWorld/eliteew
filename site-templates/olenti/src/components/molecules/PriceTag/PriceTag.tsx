import React from 'react'
import clsx from 'clsx'

export interface PriceTagProps {
  price: number
  originalPrice?: number
  discount?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const PriceTag: React.FC<PriceTagProps> = ({
  price,
  originalPrice,
  discount,
  size = 'md',
  className,
}) => {
  const sizeStyles = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  }

  return (
    <div className={clsx('flex items-baseline gap-2', className)}>
      <span className={clsx('font-bold text-primary-600', sizeStyles[size])}>
        {price}₽
      </span>
      {originalPrice && (
        <span className={clsx('text-gray-500 line-through', sizeStyles[size])}>
          {originalPrice}₽
        </span>
      )}
      {discount && (
        <span className="text-sm text-red-600 font-medium">
          -{discount}%
        </span>
      )}
    </div>
  )
}
