import { PRODUCT_COLLECTION_LABELS } from '@constants/productCollections'
import React, { useMemo, memo } from 'react'
import { ShoppingCart, Heart, Star } from 'lucide-react'
import clsx from 'clsx'

import { Card } from '@components/atoms/Card'
import { Button } from '@components/atoms/Button'
import { Badge } from '@components/atoms/Badge'
import type { Product } from '@typings/product'
import { getProductImage } from '@utils/productImages'

const CATEGORY_LABELS: Record<string, string> = {
  perfumes: 'Каталог',
  ingredients: 'Ингредиенты',
  accessories: 'Аксессуары',
}


// Memoized style objects to prevent re-creation on each render
const cardStyle = {
  background: 'var(--theme-glass-surface, linear-gradient(135deg, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0.45)))',
  borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.4))',
  backdropFilter: 'blur(14px)',
} as const

const chipStyle = {
  background: 'var(--theme-chip-bg, rgba(255,255,255,0.6))',
  color: 'var(--theme-chip-text, #2f4e40)',
  borderColor: 'color-mix(in srgb, var(--theme-chip-text, #2f4e40) 25%, transparent)',
} as const

const chipStyleLight = {
  background: 'var(--theme-chip-bg, rgba(255,255,255,0.6))',
  color: 'var(--theme-chip-text, #2f4e40)',
  borderColor: 'color-mix(in srgb, var(--theme-chip-text, #2f4e40) 20%, transparent)',
} as const

const discountStyle = {
  background: 'var(--theme-chip-bg, rgba(255,255,255,0.6))',
  color: 'var(--theme-highlight, #4f8f7f)',
  borderColor: 'color-mix(in srgb, var(--theme-highlight, #4f8f7f) 30%, transparent)',
} as const

const favoriteActiveStyle = {
  background: 'var(--theme-highlight, #4f8f7f)',
  color: '#ffffff',
  borderColor: 'var(--theme-highlight, #4f8f7f)',
} as const

const favoriteInactiveStyle = {
  background: 'var(--theme-chip-bg, rgba(255,255,255,0.5))',
  color: 'var(--theme-chip-text, #2f4e40)',
  borderColor: 'color-mix(in srgb, var(--theme-chip-text, #2f4e40) 25%, transparent)',
} as const

const headingStyle = { color: 'var(--theme-heading-color, #0a1714)' } as const
const bodyTextStyle = { color: 'var(--theme-body-text, #3a4238)' } as const
const highlightStyle = { color: 'var(--theme-highlight, #4f8f7f)' } as const
const ratingBgStyle = {
  background: 'var(--theme-muted, rgba(17,41,35,0.08))',
  borderColor: 'color-mix(in srgb, var(--theme-chip-text, #2f4e40) 10%, transparent)',
} as const
const borderStyle = { borderColor: 'color-mix(in srgb, var(--theme-card-border, rgba(255,255,255,0.55)) 50%, transparent)' } as const

export interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
  onViewDetails: (productId: string) => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

const ProductCardComponent: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onViewDetails,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const baseCategoryLabel = CATEGORY_LABELS[product.category ?? ''] ?? 'Коллекция'
  const collectionLabel = product.collection ? PRODUCT_COLLECTION_LABELS[product.collection] ?? baseCategoryLabel : baseCategoryLabel

  const starStyle = useMemo(() => (filled: boolean) => ({
    color: filled ? 'var(--theme-highlight, #4f8f7f)' : 'var(--theme-chip-text, #2f4e40)',
  }), [])

  return (
    <Card
      variant="glass"
      shadow="md"
      className="group flex h-full flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[var(--theme-card-shadow)]"
      style={cardStyle}
    >
      <div
        className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(to bottom right, var(--theme-muted, rgba(17,41,35,0.08)) 30%, transparent)',
        }}
      >
        <img
          src={getProductImage(product.image, product.name)}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-110"
          onError={(event) => {
            const target = event.target as HTMLImageElement
            target.style.display = 'none'
            if (target.parentElement) {
              target.parentElement.style.background = 'linear-gradient(to bottom right, var(--theme-muted, rgba(17,41,35,0.08)) 40%, var(--theme-card-surface, rgba(255,255,255,0.9)) 60%, var(--theme-muted, rgba(17,41,35,0.08)) 30%)'
            }
          }}
        />

        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: 'linear-gradient(to top, var(--theme-card-surface, rgba(255,255,255,0.9)) 85%, transparent)',
          }}
        />

        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.35em] backdrop-blur-md border shadow-sm transition-all duration-300"
            style={chipStyle}
          >
            {collectionLabel}
          </span>
          {product.volume && (
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.65rem] font-medium backdrop-blur-md border shadow-sm"
              style={chipStyleLight}
            >
              {product.volume}
            </span>
          )}
          {product.isNew && (
            <Badge variant="primary" className="shadow-sm">
              Новинка
            </Badge>
          )}
        </div>

        <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-10">
          {product.discount && (
            <span
              className="rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md border shadow-sm"
              style={discountStyle}
            >
              -{product.discount}%
            </span>
          )}
          {onToggleFavorite && (
            <button
              onClick={(event) => {
                event.stopPropagation()
                onToggleFavorite()
              }}
              aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
              className={clsx(
                'rounded-full p-2.5 backdrop-blur-md border shadow-sm transition-all duration-300',
                isFavorite
                  ? 'scale-110 shadow-lg'
                  : 'hover:scale-105'
              )}
              style={isFavorite ? favoriteActiveStyle : favoriteInactiveStyle}
            >
              <Heart size={18} className={clsx(isFavorite && 'fill-current')} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pt-6">
        <h3
          className="text-lg font-display transition-colors duration-300 group-hover:opacity-80 sm:text-xl"
          style={headingStyle}
        >
          {product.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm" style={bodyTextStyle}>
          {product.description}
        </p>

        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-2xl font-semibold" style={highlightStyle}>
            {product.price.toLocaleString('ru-RU')}₽
          </span>
          {product.originalPrice && (
            <span className="text-sm line-through opacity-60" style={bodyTextStyle}>
              {product.originalPrice.toLocaleString('ru-RU')}₽
            </span>
          )}
        </div>

        {product.collectionDescription && (
          <p className="mt-3 hidden text-xs line-clamp-2 opacity-70 sm:block" style={bodyTextStyle}>
            {product.collectionDescription}
          </p>
        )}

        {product.rating && (
          <div className="mt-4 flex items-center gap-3">
            <div
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 backdrop-blur-sm border"
              style={ratingBgStyle}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={14}
                  className={clsx(
                    star <= Math.round(product.rating!.average)
                      ? 'fill-current'
                      : 'opacity-30'
                  )}
                  style={starStyle(star <= Math.round(product.rating!.average))}
                />
              ))}
            </div>
            <span className="text-sm font-semibold" style={headingStyle}>
              {product.rating.average.toFixed(1)}
            </span>
            <span className="text-xs opacity-70" style={bodyTextStyle}>
              ({product.rating.count})
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3 border-t px-4 pt-4" style={borderStyle}>
        <Button
          variant="outline"
          size="sm"
          fullWidth
          onClick={() => onViewDetails(product.id)}
        >
          Подробнее
        </Button>
        <Button
          variant="primary"
          size="sm"
          fullWidth
          onClick={() => onAddToCart(product)}
        >
          <ShoppingCart size={16} className="mr-1.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          В корзину
        </Button>
      </div>
    </Card>
  )
}

export const ProductCard = memo(ProductCardComponent)
