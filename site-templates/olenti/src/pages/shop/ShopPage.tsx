import { InnerPageSkeleton, PageLoadError } from '@components/storefront/StorefrontSkeletons'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import { usePageContent } from '@hooks/usePageContent'
import { RefreshCw, Search, X } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'

import { Button } from '@components/atoms/Button'
import { Input } from '@components/atoms/Input'
import { ProductGroupGrid } from '@components/organisms/ProductGroupGrid'
import { useDebounce } from '@hooks/useDebounce'
import { useProducts } from '@services/api/products'
import type { SortOption } from '@typings/common'
import type { ProductCollection } from '@typings/product'
import { groupProductsByName } from '@utils/productGrouping'
import { useLocation, useNavigate } from 'react-router-dom'

const PRICE_FILTERS: Array<{ id: string; label: string; range: [number, number] | null }> = [
  { id: 'all', label: 'Любая цена', range: null },
  { id: 'under3k', label: 'До 3 000₽', range: [0, 2999] },
  { id: '3to6', label: '3 000 — 5 999₽', range: [3000, 5999] },
  { id: '6to10', label: '6 000 — 9 999₽', range: [6000, 9999] },
  { id: 'over10', label: '10 000₽ и выше', range: [10000, Number.MAX_SAFE_INTEGER] },
]

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'Сначала новинки' },
  { value: 'popular', label: 'Популярные' },
  { value: 'price-asc', label: 'Сначала недорогие' },
  { value: 'price-desc', label: 'Сначала премиальные' },
]

const COLLECTION_ORDER: Array<'all' | ProductCollection> = ['all', 'starter', 'signature']

const COLLECTION_META: Record<'all' | ProductCollection, { label: string; description: string; accent: string }> = {
  all: {
    label: 'Каталог',
    description: 'Подборка товаров и коллекций. Описание витрины можно задать в контент-блоках магазина.',
    accent: 'from-primary-100/50 via-white to-accent-100/40',
  },
  starter: {
    label: 'Стартовые',
    description: 'Базовые предложения для быстрого старта.',
    accent: 'from-emerald-100/60 via-white to-teal-100/40',
  },
  signature: {
    label: 'Флагманские',
    description: 'Ключевые позиции с акцентом на ценность.',
    accent: 'from-amber-100/60 via-white to-primary-100/40',
  },
  primorye: {
    label: 'Коллекция (legacy)',
    description: 'Устаревшая метка коллекции из старых данных.',
    accent: 'from-emerald-100/60 via-white to-teal-100/40',
  },
  wardrobe: {
    label: 'Коллекция (legacy)',
    description: 'Устаревшая метка коллекции из старых данных.',
    accent: 'from-amber-100/60 via-white to-primary-100/40',
  },
  rituals: {
    label: 'Коллекция (legacy)',
    description: 'Устаревшая метка коллекции из старых данных.',
    accent: 'from-rose-100/60 via-white to-purple-100/40',
  },
  exclusive: {
    label: 'Эксклюзив (legacy)',
    description: 'Устаревшая метка коллекции из старых данных.',
    accent: 'from-neutral-100/60 via-white to-primary-100/30',
  },
}

const getDefaultCollection = (pathname: string): 'all' | ProductCollection => {
  if (pathname.includes('signature')) return 'signature'
  if (pathname.includes('starter')) return 'starter'
  return 'all'
}

export const ShopPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { contentStatus, getBlock, isContentReady, isContentError, reload } = usePageContent('shop')

  const defaultCollection = useMemo(() => getDefaultCollection(location.pathname), [location.pathname])

  const [selectedCollection, setSelectedCollection] = useState<'all' | ProductCollection>(defaultCollection)
  const [priceFilter, setPriceFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [searchQuery, setSearchQuery] = useState('')

  const debouncedSearch = useDebounce(searchQuery, 350)

  // Only fetch products that are in stock for the shop
  const { data: productsData, isLoading } = useProducts({ inStock: 'true' })
  const products = useMemo(() => productsData?.data ?? [], [productsData])

  // Группируем товары по названию
  const productGroups = useMemo(() => groupProductsByName(products), [products])

  useEffect(() => {
    setSelectedCollection(defaultCollection)
    setPriceFilter('all')
    setSortBy('newest')
    setSearchQuery('')
  }, [defaultCollection])

  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: productGroups.length }
    productGroups.forEach((group) => {
      const key = group.collection ?? 'other'
      counts[key] = (counts[key] ?? 0) + 1
    })
    return counts
  }, [productGroups])

  const filteredProductGroups = useMemo(() => {
    let result = [...productGroups]

    if (selectedCollection !== 'all') {
      result = result.filter((group) => group.collection === selectedCollection)
    }

    if (debouncedSearch) {
      const term = debouncedSearch.trim().toLowerCase()
      result = result.filter((group) =>
        group.name.toLowerCase().includes(term) || group.description.toLowerCase().includes(term)
      )
    }

    // Фильтрация по цене
    if (priceFilter !== 'all') {
      const priceRange = PRICE_FILTERS.find((f) => f.id === priceFilter)?.range
      if (priceRange) {
        const [min, max] = priceRange
        result = result.filter((group) => {
          // Проверяем, пересекается ли диапазон цен группы с фильтром
          return group.minPrice <= max && group.maxPrice >= min
        })
      }
    }

    return result
  }, [productGroups, selectedCollection, debouncedSearch, priceFilter])

  if (contentStatus === 'loading' || !isContentReady) {
    return <InnerPageSkeleton />
  }
  if (isContentError) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-20">
        <PageLoadError label="Не удалось загрузить контент витрины." onRetry={reload} />
      </div>
    )
  }

  const currentCollectionMeta = COLLECTION_META[selectedCollection] ?? COLLECTION_META.all
  const heroTitle =
    selectedCollection === 'all'
      ? getBlock('hero', 'title', currentCollectionMeta.label)
      : currentCollectionMeta.label
  const heroDescription =
    selectedCollection === 'all'
      ? getBlock('hero', 'description', currentCollectionMeta.description)
      : currentCollectionMeta.description

  const hasActiveFilters =
    selectedCollection !== defaultCollection ||
    priceFilter !== 'all' ||
    debouncedSearch.length > 0 ||
    sortBy !== 'newest'

  const handleViewDetails = (groupId: string) => {
    navigate(`/shop/${groupId}`)
  }

  const handleResetFilters = () => {
    setSelectedCollection(defaultCollection)
    setPriceFilter('all')
    setSortBy('newest')
    setSearchQuery('')
  }

  return (
    <div className="container mx-auto px-4 py-12 sm:py-16">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-[36px] border border-white/50 bg-white/70 px-6 py-10 shadow-floating backdrop-blur-xl sm:px-10"
      >
        <div
          className={clsx(
            'pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br opacity-90 blur-2xl',
            currentCollectionMeta.accent
          )}
        />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.45em] text-neutral-500">
              Коллекции бренда
            </span>
            <h1 className="text-3xl font-display text-neutral-900 sm:text-4xl lg:text-5xl">
              <span className="gradient-text">{heroTitle}</span>
            </h1>
            <p className="text-base text-neutral-600 sm:text-lg">
              {heroDescription}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 text-sm text-neutral-600 md:grid-cols-1">
            <div className="rounded-3xl border border-white/60 bg-white/80 px-5 py-4 text-center shadow-sm">
              <p className="text-xs uppercase tracking-[0.35em] text-neutral-400">В подборке</p>
              <p className="mt-2 text-3xl font-display text-primary-700">
                {filteredProductGroups.length}
              </p>
            </div>
            <div className="rounded-3xl border border-white/60 bg-white/80 px-5 py-4 text-center shadow-sm">
              <p className="text-xs uppercase tracking-[0.35em] text-neutral-400">Всего в магазине</p>
              <p className="mt-2 text-3xl font-display text-primary-700">
                {productGroups.length}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="mt-10 space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            {COLLECTION_ORDER.filter((key) => key === 'all' || (collectionCounts[key] ?? 0) > 0).map((collectionKey) => (
              <button
                key={collectionKey}
                onClick={() => setSelectedCollection(collectionKey)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition-all duration-300',
                  selectedCollection === collectionKey
                    ? 'border-primary-400 bg-primary-100/80 text-primary-700'
                    : 'border-white/70 bg-white/80 text-neutral-500 hover:border-primary-200 hover:text-primary-600'
                )}
              >
                <span>
                  {collectionKey === 'all'
                    ? getBlock('hero', 'title', COLLECTION_META.all.label)
                    : COLLECTION_META[collectionKey].label}
                </span>
                <span className="text-[0.65rem] text-neutral-400">
                  {(collectionCounts[collectionKey] ?? 0).toString().padStart(2, '0')}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск по названию или истории"
                className="pl-11 pr-10 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/90 p-1.5 text-neutral-400 transition-colors duration-200 hover:text-primary-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="appearance-none rounded-2xl border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-neutral-600 shadow-sm transition-colors duration-200 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">▾</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {PRICE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setPriceFilter(filter.id)}
              className={clsx(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.3em] transition-all duration-300',
                priceFilter === filter.id
                  ? 'border-primary-400 bg-primary-100/80 text-primary-700 shadow-glow'
                  : 'border-white/70 bg-white/85 text-neutral-500 hover:border-primary-200 hover:text-primary-600'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <Button
              type="button"
              variant="ghost"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 hover:border-primary-300 hover:text-primary-600"
            >
              <RefreshCw size={16} />
              Сбросить фильтры
            </Button>
            <span className="text-xs uppercase tracking-[0.3em]">Активных фильтров: Да</span>
          </div>
        )}
      </div>

      <div className="mt-12">
        <ProductGroupGrid
          productGroups={filteredProductGroups}
          isLoading={isLoading}
          onViewDetails={handleViewDetails}
          sortBy={sortBy}
        />
      </div>
    </div>
  )
}
