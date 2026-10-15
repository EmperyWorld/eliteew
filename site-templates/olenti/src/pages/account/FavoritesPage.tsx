import React from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, ArrowLeft, ShoppingCart, Trash2, Loader2 } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { Button } from '@components/atoms/Button'
import { useUserStore } from '@store/slices/userSlice'
import { ROUTES } from '@constants/routes'
import { useUserFavorites, useRemoveFavorite } from '@services/api/account'
import { useCartStore } from '@store/slices/cartSlice'

export const FavoritesPage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useUserStore()
  const { data: favorites, isLoading, error } = useUserFavorites()
  const removeMutation = useRemoveFavorite()
  const addToCart = useCartStore((state) => state.addItem)

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.AUTH_LOGIN)
    }
  }, [isAuthenticated, navigate])

  const handleRemoveFromFavorites = (productId: string) => {
    removeMutation.mutate(productId)
  }

  const handleAddToCart = (product: NonNullable<typeof favorites>[0]['product']) => {
    const firstVariant = product.variants?.[0]
    addToCart(
      firstVariant
        ? { ...product, price: firstVariant.price, originalPrice: firstVariant.oldPrice ?? product.originalPrice, volume: firstVariant.volume }
        : product,
      1,
      firstVariant?.volume,
      firstVariant?.id,
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <Card className="p-12 text-center">
          <Heart size={64} className="mx-auto text-neutral-300 mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">
            Ошибка загрузки избранного
          </h2>
          <p className="text-neutral-500 mb-6">
            Попробуйте обновить страницу
          </p>
          <Button onClick={() => window.location.reload()}>
            Обновить
          </Button>
        </Card>
      </div>
    )
  }

  const allFavorites = favorites ?? []

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-4 mb-8">
          <Link
            to={ROUTES.ACCOUNT_PROFILE}
            className="p-2 rounded-xl hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-neutral-900">
            Избранное
          </h1>
          {allFavorites.length > 0 && (
            <span className="px-3 py-1 bg-primary-100 text-primary-700 text-sm font-medium rounded-full">
              {allFavorites.length}
            </span>
          )}
        </div>

        {allFavorites.length === 0 ? (
          <Card className="p-12 text-center">
            <Heart size={64} className="mx-auto text-neutral-300 mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              В избранном пока пусто
            </h2>
            <p className="text-neutral-500 mb-6">
              Добавляйте товары в избранное, чтобы не потерять их
            </p>
            <Button onClick={() => navigate(ROUTES.SHOP)}>
              Перейти в магазин
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allFavorites.map((item, index) => {
              const product = item.product
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden group">
                    <div className="aspect-square bg-neutral-100 relative">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300">
                          <Heart size={48} />
                        </div>
                      )}
                      {product.status !== 'available' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="px-4 py-2 bg-white rounded-full text-sm font-medium">
                            Нет в наличии
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => handleRemoveFromFavorites(product.id)}
                        disabled={removeMutation.isPending}
                        className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 disabled:opacity-50"
                        aria-label="Удалить из избранного"
                      >
                        <Trash2 size={18} className="text-red-500" />
                      </button>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-neutral-500 mb-1">{product.category}</p>
                      <h3 className="font-medium text-neutral-900 mb-2 line-clamp-2">
                        {product.name}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-primary-600">
                          {product.price.toLocaleString('ru-RU')} ₽
                        </span>
                        <Button
                          size="sm"
                          disabled={product.status !== 'available'}
                          onClick={() => handleAddToCart(product)}
                          className="gap-2"
                        >
                          <ShoppingCart size={16} />
                          В корзину
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}
