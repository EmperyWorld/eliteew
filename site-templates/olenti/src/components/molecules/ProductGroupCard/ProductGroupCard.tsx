import { PRODUCT_COLLECTION_LABELS } from '@constants/productCollections'
import React from 'react'
import { Heart, Star } from 'lucide-react'
import clsx from 'clsx'

import { Card } from '@components/atoms/Card'
import { Button } from '@components/atoms/Button'
import { Badge } from '@components/atoms/Badge'
import type { ProductGroup } from '@typings/product'
import { getProductImage } from '@utils/productImages'

const CATEGORY_LABELS: Record<string, string> = {
  perfumes: 'Каталог',
  ingredients: 'Ингредиенты',
  accessories: 'Аксессуары',
}


export interface ProductGroupCardProps {
  productGroup: ProductGroup
  onViewDetails: (groupId: string) => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

export const ProductGroupCard: React.FC<ProductGroupCardProps> = ({
  productGroup,
  onViewDetails,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const baseCategoryLabel = CATEGORY_LABELS[productGroup.category ?? ''] ?? 'Коллекция'
  const collectionLabel = productGroup.collection
    ? PRODUCT_COLLECTION_LABELS[productGroup.collection] ?? baseCategoryLabel
    : baseCategoryLabel

  const hasMultipleVariants = productGroup.variants.length > 1
  const priceDisplay =
    hasMultipleVariants
      ? `${productGroup.minPrice.toLocaleString('ru-RU')}₽ — ${productGroup.maxPrice.toLocaleString('ru-RU')}₽`
      : `${productGroup.minPrice.toLocaleString('ru-RU')}₽`

  return (
    <Card
      variant="glass"
      shadow="md"
      className="group flex h-full flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[var(--theme-card-shadow)]"
      style={{
        background: 'var(--theme-glass-surface, linear-gradient(135deg, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0.45)))',
        borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.4))',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(to bottom right, var(--theme-muted, rgba(17,41,35,0.08)) 30%, transparent)',
        }}
      >
        <img
          src={getProductImage(productGroup.image, productGroup.name)}
          alt={productGroup.name}
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
            style={{
              background: 'var(--theme-chip-bg, rgba(255,255,255,0.6))',
              color: 'var(--theme-chip-text, #2f4e40)',
              borderColor: 'color-mix(in srgb, var(--theme-chip-text, #2f4e40) 25%, transparent)',
            }}
          >
            {collectionLabel}
          </span>
          {hasMultipleVariants && (
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.65rem] font-medium backdrop-blur-md border shadow-sm"
              style={{
                background: 'var(--theme-chip-bg, rgba(255,255,255,0.6))',
                color: 'var(--theme-chip-text, #2f4e40)',
                borderColor: 'color-mix(in srgb, var(--theme-chip-text, #2f4e40) 20%, transparent)',
              }}
            >
              {productGroup.variants.length} варианта
            </span>
          )}
          {productGroup.isNew && (
            <Badge variant="primary" className="shadow-sm">
              Новинка
            </Badge>
          )}
        </div>

        <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-10">
          {onToggleFavorite && (
            <button
              onClick={(event) => {
                event.stopPropagation()
                onToggleFavorite()
              }}
              className={clsx(
                'rounded-full p-2.5 backdrop-blur-md border shadow-sm transition-all duration-300',
                isFavorite
                  ? 'scale-110 shadow-lg'
                  : 'hover:scale-105'
              )}
              style={
                isFavorite
                  ? {
                      background: 'var(--theme-highlight, #4f8f7f)',
                      color: '#ffffff',
                      borderColor: 'var(--theme-highlight, #4f8f7f)',
                    }
                  : {
                      background: 'var(--theme-chip-bg, rgba(255,255,255,0.5))',
                      color: 'var(--theme-chip-text, #2f4e40)',
                      borderColor: 'color-mix(in srgb, var(--theme-chip-text, #2f4e40) 25%, transparent)',
                    }
              }
            >
              <Heart size={18} className={clsx(isFavorite && 'fill-current')} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pt-6">
        <h3
          className="text-lg font-display transition-colors duration-300 group-hover:opacity-80 sm:text-xl"
          style={{ color: 'var(--theme-heading-color, #0a1714)' }}
        >
          {productGroup.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm" style={{ color: 'var(--theme-body-text, #3a4238)' }}>
          {productGroup.description}
        </p>

        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-2xl font-semibold" style={{ color: 'var(--theme-highlight, #4f8f7f)' }}>
            {priceDisplay}
          </span>
        </div>

        {productGroup.collectionDescription && (
          <p className="mt-3 hidden text-xs line-clamp-2 opacity-70 sm:block" style={{ color: 'var(--theme-body-text, #3a4238)' }}>
            {productGroup.collectionDescription}
          </p>
        )}

        {productGroup.rating && (
          <div className="mt-4 flex items-center gap-3">
            <div
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 backdrop-blur-sm border"
              style={{
                background: 'var(--theme-muted, rgba(17,41,35,0.08))',
                borderColor: 'color-mix(in srgb, var(--theme-chip-text, #2f4e40) 10%, transparent)',
              }}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={14}
                  className={clsx(
                    star <= Math.round(productGroup.rating!.average)
                      ? 'fill-current'
                      : 'opacity-30'
                  )}
                  style={{
                    color:
                      star <= Math.round(productGroup.rating!.average)
                        ? 'var(--theme-highlight, #4f8f7f)'
                        : 'var(--theme-chip-text, #2f4e40)',
                  }}
                />
              ))}
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--theme-heading-color, #0a1714)' }}>
              {productGroup.rating.average.toFixed(1)}
            </span>
            <span className="text-xs opacity-70" style={{ color: 'var(--theme-body-text, #3a4238)' }}>
              ({productGroup.rating.count})
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3 border-t px-4 pt-4" style={{ borderColor: 'color-mix(in srgb, var(--theme-card-border, rgba(255,255,255,0.55)) 50%, transparent)' }}>
        <Button
          variant="primary"
          size="sm"
          fullWidth
          onClick={() => onViewDetails(productGroup.id)}
        >
          Выбрать объем
        </Button>
      </div>
    </Card>
  )
}
