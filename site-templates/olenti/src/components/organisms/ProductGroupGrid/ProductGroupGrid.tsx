import React, { useState, useMemo, memo } from 'react'
import { ProductGroupCard } from '@components/molecules/ProductGroupCard'
import { ProductCardSkeleton } from '@components/atoms/Skeleton'
import { Button } from '@components/atoms/Button'
import type { ProductGroup } from '@typings/product'
import type { SortOption } from '@typings/common'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Memoized skeleton grid for loading state
const SkeletonGrid = memo(() => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} style={{ animationDelay: `${i * 50}ms` }} className="animate-in fade-in">
        <ProductCardSkeleton />
      </div>
    ))}
  </div>
))

export interface ProductGroupGridProps {
  productGroups: ProductGroup[]
  isLoading?: boolean
  onViewDetails: (groupId: string) => void
  sortBy?: SortOption
  itemsPerPage?: number
}

export const ProductGroupGrid: React.FC<ProductGroupGridProps> = ({
  productGroups,
  isLoading = false,
  onViewDetails,
  sortBy = 'newest',
  itemsPerPage = 12,
}) => {
  const [currentPage, setCurrentPage] = useState(1)

  const sortedProductGroups = useMemo(() => {
    const result = [...productGroups]

    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.minPrice - b.minPrice)
        break
      case 'price-desc':
        result.sort((a, b) => b.maxPrice - a.maxPrice)
        break
      case 'popular':
        result.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0))
        break
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
    }

    return result
  }, [productGroups, sortBy])

  const totalPages = Math.ceil(sortedProductGroups.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedGroups = sortedProductGroups.slice(startIndex, startIndex + itemsPerPage)

  if (isLoading) {
    return <SkeletonGrid />
  }

  if (sortedProductGroups.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-6">
          <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-2xl font-semibold text-gray-700 mb-2">Товары не найдены</p>
        <p className="text-gray-500">Попробуйте изменить параметры поиска</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
        {paginatedGroups.map((group, index) => (
          <div
            key={group.id}
            className="animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <ProductGroupCard
              productGroup={group}
              onViewDetails={onViewDetails}
            />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-12">
          <Button
            variant="outline"
            size="md"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="group"
          >
            <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            Назад
          </Button>

          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'primary' : 'outline'}
                    size="md"
                    onClick={() => setCurrentPage(page)}
                    className={currentPage === page ? 'scale-110 shadow-xl' : ''}
                  >
                    {page}
                  </Button>
                )
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return <span key={`ellipsis-${page}`} className="px-2 text-gray-400">...</span>
              }
              return null
            })}
          </div>

          <Button
            variant="outline"
            size="md"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="group"
          >
            Далее
            <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      )}
    </div>
  )
}
