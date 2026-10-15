import React from 'react'
import { CheckIcon } from 'lucide-react'
import clsx from 'clsx'

export interface CheckboxProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked = false,
  onChange,
  label,
  disabled = false,
  className,
}) => {
  return (
    <label className={clsx('flex items-center gap-2 cursor-pointer', className)}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={clsx(
            'w-5 h-5 border-2 rounded transition-colors flex items-center justify-center',
            checked
              ? 'bg-primary-600 border-primary-600'
              : 'border-gray-300 bg-white',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {checked && <CheckIcon size={14} className="text-white" />}
        </div>
      </div>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  )
}
