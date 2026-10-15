import React from 'react'
import clsx from 'clsx'
import type { TextareaHTMLAttributes } from 'react'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
  fullWidth?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, fullWidth = true, className, ...props }, ref) => {
    return (
      <div className={clsx("relative", fullWidth && "w-full")}>
        <textarea
          ref={ref}
          className={clsx(
            'w-full rounded-2xl px-4 py-3 transition-all duration-300',
            'backdrop-blur-md border',
            'focus:outline-none',
            error ? 'theme-input-error' : 'theme-input',
            className
          )}
          {...props}
        />
        {error && (
          <div className="absolute -bottom-5 left-0 text-xs text-red-500 mt-1">
            {error}
          </div>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
