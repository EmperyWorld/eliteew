import React, { useState, useMemo } from 'react'
import { ProductCard } from '@components/molecules/ProductCard'
import { Loader } from '@components/atoms/Loader'
import { Button } from '@components/atoms/Button'
import type { Product } from '@typings/product'
import type { Filter, SortOption } from '@typings/common'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface ProductGridProps {
  products: Product[]
  isLoading?: boolean
  onAddToCart: (product: Product) => void
  onViewDetails: (productId: string) => void
  filters?: Filter
  sortBy?: SortOption
  itemsPerPage?: number
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  isLoading = false,
  onAddToCart,
  onViewDetails,
  filters,
  sortBy = 'newest',
  itemsPerPage = 12,
}) => {
  const [currentPage, setCurrentPage] = useState(1)

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products]

    if (filters?.category) {
      result = result.filter(p => p.category === filters.category)
    }

    if (filters?.priceRange) {
      const [min, max] = filters.priceRange
      result = result.filter(p => p.price >= min && p.price <= max)
    }

    if (filters?.rating) {
      result = result.filter(p => (p.rating?.average || 0) >= filters.rating!)
    }

    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        result.sort((a, b) => b.price - a.price)
        break
      case 'popular':
        result.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0))
        break
      case 'newest':
      default:
        break
    }

    return result
  }, [products, filters, sortBy])

  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedProducts = filteredAndSortedProducts.slice(
    startIndex,
    startIndex + itemsPerPage
  )

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="relative">
          <Loader size="lg" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-200/50 to-accent-200/50 rounded-full blur-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (filteredAndSortedProducts.length === 0) {
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
        {paginatedProducts.map((product, index) => (
          <div
            key={product.id}
            className="animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <ProductCard
              product={product}
              onAddToCart={onAddToCart}
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
