import React, { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@components/atoms/Input'
import clsx from 'clsx'

export interface SearchBarProps {
  placeholder?: string
  onSearch: (query: string) => void
  className?: string
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Поиск...',
  onSearch,
  className,
}) => {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    onSearch(value)
  }

  const handleClear = () => {
    setQuery('')
    onSearch('')
  }

  return (
    <div className={clsx("relative group", className)}>
      <div
        className={clsx(
          'absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/20 via-white/50 to-accent-400/20 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100',
          isFocused && 'opacity-100'
        )}
      />
      <div className="relative flex items-center">
        <Search className={clsx(
          'absolute left-4 top-1/2 z-10 -translate-y-1/2 transition-colors duration-200',
          isFocused ? 'text-primary-600' : 'text-neutral-400'
        )} size={20} />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={clsx(
            'glass w-full border border-white/60 bg-white/70 px-12 pr-12 text-sm transition-all duration-300',
            isFocused
              ? 'border-primary-400/70 shadow-outline shadow-primary-500/20'
              : 'hover:border-primary-200/50'
          )}
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-white/40 bg-white/60 p-1.5 text-neutral-400 transition-all duration-200 hover:border-primary-200/60 hover:text-primary-600"
            aria-label="Очистить поиск"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
