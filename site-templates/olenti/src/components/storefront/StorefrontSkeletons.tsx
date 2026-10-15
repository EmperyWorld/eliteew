import { AlertCircle } from 'lucide-react'
import React from 'react'

const pulse = 'animate-pulse rounded-xl bg-neutral-200/80 dark:bg-neutral-700/50'

export const HeroSectionSkeleton: React.FC = () => (
  <section className="relative overflow-hidden pt-20 pb-24 sm:pt-24 sm:pb-32">
    <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
        <div className="space-y-8 sm:space-y-10">
          <div className={`h-8 w-48 ${pulse}`} />
          <div className="space-y-3">
            <div className={`h-14 w-full max-w-xl ${pulse}`} />
            <div className={`h-14 w-full max-w-lg ${pulse}`} />
          </div>
          <div className="space-y-2">
            <div className={`h-4 w-full max-w-2xl ${pulse}`} />
            <div className={`h-4 w-full max-w-xl ${pulse}`} />
            <div className={`h-4 w-full max-w-lg ${pulse}`} />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className={`h-12 w-full sm:w-48 ${pulse}`} />
            <div className={`h-12 w-full sm:w-44 ${pulse}`} />
          </div>
        </div>
        <div className={`hidden min-h-[320px] w-full rounded-[32px] lg:block ${pulse}`} />
      </div>
    </div>
  </section>
)

export const HomePageSkeleton: React.FC = () => (
  <div className="min-h-screen">
    <HeroSectionSkeleton />
    <section className="container mx-auto px-4 py-16">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className={`aspect-[3/4] w-full max-w-md rounded-[32px] ${pulse}`} />
        <div className="space-y-4">
          <div className={`h-6 w-32 ${pulse}`} />
          <div className={`h-10 w-3/4 ${pulse}`} />
          <div className={`h-24 w-full ${pulse}`} />
          <div className={`h-24 w-full ${pulse}`} />
          <div className="flex gap-3">
            <div className={`h-11 w-40 ${pulse}`} />
            <div className={`h-11 w-44 ${pulse}`} />
          </div>
        </div>
      </div>
    </section>
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className={`mx-auto mb-10 h-10 w-64 ${pulse}`} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-40 rounded-3xl ${pulse}`} />
          ))}
        </div>
      </div>
    </section>
    <section className="container mx-auto px-4 py-16">
      <div className={`mb-8 h-9 w-72 ${pulse}`} />
      <div className={`h-32 w-full max-w-3xl ${pulse}`} />
    </section>
  </div>
)

export const InnerPageSkeleton: React.FC<{ withHeroImage?: boolean }> = ({ withHeroImage }) => (
  <div className="min-h-[60vh] space-y-10 px-4 py-16 sm:px-6">
    <div className={`h-10 w-2/3 max-w-lg ${pulse}`} />
    <div className={`h-5 w-full max-w-2xl ${pulse}`} />
    <div className={`h-5 w-full max-w-xl ${pulse}`} />
    {withHeroImage ? <div className={`mt-8 aspect-video w-full max-w-4xl rounded-3xl ${pulse}`} /> : null}
    <div className="space-y-3 pt-8">
      <div className={`h-4 w-full ${pulse}`} />
      <div className={`h-4 w-full ${pulse}`} />
      <div className={`h-4 w-2/3 ${pulse}`} />
    </div>
  </div>
)

export const PageLoadError: React.FC<{ label: string; onRetry: () => void }> = ({ label, onRetry }) => (
  <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-red-200/60 bg-red-50/50 px-6 py-10 text-center dark:border-red-900/40 dark:bg-red-950/20">
    <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" aria-hidden />
    <p className="text-sm text-neutral-700 dark:text-neutral-200">{label}</p>
    <button
      type="button"
      onClick={onRetry}
      className="rounded-full bg-primary-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
    >
      Повторить
    </button>
  </div>
)
