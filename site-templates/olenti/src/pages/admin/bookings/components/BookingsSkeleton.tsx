import React from 'react'

export const BookingsSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse"
          >
            <div className="h-4 w-20 bg-neutral-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-7 w-16 bg-neutral-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>

      <div className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="h-11 w-full bg-neutral-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-11 w-32 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-11 w-60 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
        </div>
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-neutral-200 dark:bg-slate-700" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-neutral-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-24 bg-neutral-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
            <div className="h-6 w-20 bg-neutral-200 dark:bg-slate-700 rounded-full" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="h-4 w-full bg-neutral-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-full bg-neutral-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-full bg-neutral-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
