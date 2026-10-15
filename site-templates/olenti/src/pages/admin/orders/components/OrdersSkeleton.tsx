import React from 'react'

export const OrdersSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 animate-pulse">
            <div className="h-4 w-20 bg-neutral-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-8 w-16 bg-neutral-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>

      {/* Filter skeleton */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-10 w-32 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-10 w-40 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
          <div className="ml-auto h-10 w-20 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
        </div>
      </div>

      {/* Orders skeleton */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-neutral-200 dark:bg-slate-700" />
              <div className="space-y-2">
                <div className="h-5 w-32 bg-neutral-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-48 bg-neutral-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-24 bg-neutral-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
            <div className="space-y-2 text-right">
              <div className="h-6 w-20 bg-neutral-200 dark:bg-slate-700 rounded-full ml-auto" />
              <div className="h-6 w-24 bg-neutral-200 dark:bg-slate-700 rounded ml-auto" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-slate-700 flex gap-2">
            <div className="h-4 w-32 bg-neutral-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-24 bg-neutral-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
