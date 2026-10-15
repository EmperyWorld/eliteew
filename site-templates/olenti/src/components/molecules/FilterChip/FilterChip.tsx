import React from 'react'
import { X } from 'lucide-react'
import { Badge } from '@components/atoms/Badge'

export interface FilterChipProps {
  label: string
  onRemove?: () => void
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info'
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  onRemove,
  variant = 'primary',
}) => {
  return (
    <Badge variant={variant} className="flex items-center gap-1">
      {label}
      {onRemove && (
        <button onClick={onRemove} className="ml-1 hover:opacity-70">
          <X size={14} />
        </button>
      )}
    </Badge>
  )
}
