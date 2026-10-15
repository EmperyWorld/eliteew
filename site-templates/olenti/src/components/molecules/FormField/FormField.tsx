import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import clsx from 'clsx'
import { Label } from '@components/atoms/Label'
import { Input } from '@components/atoms/Input'

export interface FormFieldProps<T extends FieldValues> {
  name: FieldPath<T>
  control: Control<T>
  label: string
  placeholder?: string
  type?: string
  error?: string
  description?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export function FormField<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  type = 'text',
  error,
  description,
  required = false,
  disabled = false,
  className,
}: FormFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className={clsx('mb-4', className)}>
          <Label required={required}>{label}</Label>
          <Input
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            error={error}
            {...field}
          />
          {error && (
            <p className="mt-1 text-sm text-red-500">{error}</p>
          )}
          {description && !error && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
      )}
    />
  )
}
