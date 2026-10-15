import React from 'react'
import clsx from 'clsx'
import type { LabelHTMLAttributes } from 'react'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
  children: React.ReactNode
}

export const Label: React.FC<LabelProps> = ({
  required = false,
  className,
  children,
  ...props
}) => {
  return (
    <label
      className={clsx(
        'block text-sm font-medium text-gray-700 mb-1.5',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
}
