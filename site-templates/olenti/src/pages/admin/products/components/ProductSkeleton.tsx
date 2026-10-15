import React from 'react'

interface ProductSkeletonProps {
  viewMode: 'grid' | 'list'
  count?: number
}

export const ProductSkeleton: React.FC<ProductSkeletonProps> = ({ viewMode, count = 8 }) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 overflow-hidden animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {/* Image skeleton */}
            <div className="aspect-square bg-gradient-to-br from-neutral-200 to-neutral-100 dark:from-slate-700 dark:to-slate-600">
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-neutral-300 dark:bg-slate-600 animate-pulse" />
              </div>
            </div>

            {/* Content skeleton */}
            <div className="p-4 space-y-3">
              {/* Badge */}
              <div className="flex items-center justify-between">
                <div className="h-6 w-24 bg-neutral-200 dark:bg-slate-700 rounded-full" />
                <div className="h-4 w-12 bg-neutral-200 dark:bg-slate-700 rounded" />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <div className="h-5 w-full bg-neutral-200 dark:bg-slate-700 rounded" />
                <div className="h-5 w-2/3 bg-neutral-200 dark:bg-slate-700 rounded" />
              </div>

              {/* Price */}
              <div className="pt-2 border-t border-neutral-100 dark:border-slate-700">
                <div className="h-8 w-28 bg-neutral-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // List skeleton
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 overflow-hidden">
      <div className="divide-y divide-neutral-100 dark:divide-slate-700">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 animate-pulse"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            {/* Checkbox */}
            <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-slate-700" />

            {/* Image */}
            <div className="w-12 h-12 rounded-xl bg-neutral-200 dark:bg-slate-700" />

            {/* Content */}
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-neutral-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-24 bg-neutral-200 dark:bg-slate-700 rounded" />
            </div>

            {/* Badge */}
            <div className="h-6 w-32 bg-neutral-200 dark:bg-slate-700 rounded-full hidden sm:block" />

            {/* Volume */}
            <div className="h-4 w-16 bg-neutral-200 dark:bg-slate-700 rounded" />

            {/* Price */}
            <div className="h-5 w-20 bg-neutral-200 dark:bg-slate-700 rounded" />

            {/* Status */}
            <div className="h-6 w-24 bg-neutral-200 dark:bg-slate-700 rounded-full hidden md:block" />

            {/* Actions */}
            <div className="flex gap-1">
              <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-slate-700" />
              <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
