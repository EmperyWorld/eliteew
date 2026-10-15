import { PRODUCT_COLLECTION_LABELS } from '@constants/productCollections'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@components/atoms/Badge'
import { Button } from '@components/atoms/Button'
import { ROUTES } from '@constants/routes'
import { useCart } from '@hooks/useCart'
import { useProducts } from '@services/api/products'
import type { Product } from '@typings/product'
import { findProductGroup, findProductVariant, groupProductsByName } from '@utils/productGrouping'
import { getProductImage } from '@utils/productImages'


export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToCart } = useCart()
  // Only show products that are in stock
  const { data: productsData } = useProducts({ inStock: 'true' })
  const products = React.useMemo(() => productsData?.data ?? [], [productsData])

  const [selectedVolume, setSelectedVolume] = useState<string>('')

  const productGroups = React.useMemo(() => groupProductsByName(products), [products])
  const productGroup = id ? findProductGroup(productGroups, id) : undefined
  const selectedVariant = productGroup && selectedVolume
    ? findProductVariant(productGroup, selectedVolume)
    : undefined

  useEffect(() => {
    if (productGroup && productGroup.variants.length > 0 && !selectedVolume) {
      setSelectedVolume(productGroup.variants[0].volume)
    }
  }, [productGroup, selectedVolume])

  if (!productGroup) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-display mb-4">Товар не найден</h1>
        <Button onClick={() => navigate(ROUTES.SHOP)}>Вернуться в магазин</Button>
      </div>
    )
  }

  const handleAddToCart = () => {
    if (!selectedVariant || !productGroup) return

    // Для корзины используем product.id (не variant.id), чтобы backend принимал productId
    const cartProduct = {
      id: productGroup.id,
      name: productGroup.name,
      description: productGroup.description,
      price: selectedVariant.price,
      originalPrice: selectedVariant.originalPrice,
      image: productGroup.image,
      images: productGroup.images || [],
      category: productGroup.category,
      collection: productGroup.collection,
      volume: selectedVariant.volume,
      status: selectedVariant.status,
      isNew: productGroup.isNew,
      createdAt: productGroup.createdAt,
      updatedAt: productGroup.updatedAt,
    }

    addToCart(cartProduct as Product, 1, selectedVariant.volume, selectedVariant.id)
  }

  const collectionLabel = productGroup.collection
    ? PRODUCT_COLLECTION_LABELS[productGroup.collection] ?? 'Коллекция'
    : 'Коллекция'

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <Button
        variant="ghost"
        onClick={() => navigate(ROUTES.SHOP)}
        className="mb-6 inline-flex items-center gap-2"
      >
        <ArrowLeft size={18} />
        Назад в магазин
      </Button>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-2">
        {/* Изображение */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative aspect-square w-full overflow-hidden rounded-3xl"
          style={{
            background: 'linear-gradient(to bottom right, var(--theme-muted, rgba(17,41,35,0.08)) 30%, transparent)',
          }}
        >
          <img
            src={getProductImage(productGroup.image, productGroup.name)}
            alt={productGroup.name}
            className="h-full w-full object-cover"
          />
        </motion.div>

        {/* Информация */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col gap-6"
        >
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge variant="primary">{collectionLabel}</Badge>
              {productGroup.isNew && <Badge variant="primary">Новинка</Badge>}
            </div>
            <h1 className="text-3xl font-display sm:text-4xl theme-heading-color">
              {productGroup.name}
            </h1>
          </div>

          {/* Выбор объема */}
          <div>
            <h3 className="mb-3 text-lg font-semibold theme-heading-color">
              Выберите объем:
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
              {productGroup.variants.map((variant) => {
                const isSelected = variant.volume === selectedVolume
                return (
                  <button
                    type="button"
                    key={variant.id}
                    onClick={() => setSelectedVolume(variant.volume)}
                    className={clsx(
                      'rounded-2xl border p-4 text-left transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                      'bg-white/80 backdrop-blur-sm',
                      isSelected
                        ? 'border-primary-500 ring-2 ring-primary-200 shadow-lg'
                        : 'border-neutral-200 hover:border-primary-300'
                    )}
                  >
                    <div className="text-sm font-semibold theme-heading-color">
                      {variant.volume}
                    </div>
                    <div className="mt-1 text-lg font-bold theme-highlight-color">
                      {variant.price.toLocaleString('ru-RU')}₽
                    </div>
                    {variant.originalPrice && (
                      <div className="mt-1 text-xs line-through opacity-60 theme-body-text">
                        {variant.originalPrice.toLocaleString('ru-RU')}₽
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Кнопка добавления в корзину - desktop */}
          <div className="hidden lg:flex gap-3">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleAddToCart}
              disabled={!selectedVariant}
            >
              <ShoppingCart size={20} className="mr-2" />
              Добавить в корзину
            </Button>
          </div>

          {/* Описание коллекции */}
          {productGroup.description && (
            <div className="rounded-2xl border p-4 theme-glass-surface theme-glass-border">
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] theme-heading-color">
                Описание коллекции
              </h4>
              <p className="text-sm theme-body-text">
                {productGroup.description}
              </p>
            </div>
          )}

          {/* Дополнительная информация */}
          {productGroup.collectionDescription && (
            <div className="rounded-2xl border p-4 theme-glass-surface theme-glass-border">
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] theme-heading-color">
                О коллекции
              </h4>
              <p className="text-sm theme-body-text">
                {productGroup.collectionDescription}
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Mobile sticky add to cart */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-lg border-t border-neutral-200 lg:hidden z-40">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm text-neutral-600">{selectedVolume}</p>
            <p className="text-lg font-semibold text-neutral-900">
              {selectedVariant?.price.toLocaleString('ru-RU')} ₽
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={handleAddToCart}
            disabled={!selectedVariant}
            className="gap-2"
          >
            <ShoppingCart size={18} />
            В корзину
          </Button>
        </div>
      </div>
      <div className="h-24 lg:hidden" />
    </div>
  )
}
