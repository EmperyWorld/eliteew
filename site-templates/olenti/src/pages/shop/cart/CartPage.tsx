import { Button } from '@components/atoms/Button'
import { CartItem } from '@components/molecules/CartItem'
import { CartSummary } from '@components/organisms/CartSummary'
import { ROUTES } from '@constants/routes'
import { useCartStore } from '@store/slices/cartSlice'
import { useUserStore } from '@store/slices/userSlice'
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

export const CartPage: React.FC = () => {
  const { items, removeItem, updateQuantity } = useCartStore()
  const navigate = useNavigate()
  const { isAuthenticated } = useUserStore()

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12 text-center">
        <h1 className="text-2xl sm:text-3xl font-display font-bold mb-4">Корзина пуста</h1>
        <p className="text-gray-600 mb-6 sm:mb-8">Добавьте товары в корзину</p>
        <Link to={ROUTES.SHOP}>
          <Button>Перейти в магазин</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-display font-bold mb-6 sm:mb-8">Корзина</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {items.map((item) => (
            <CartItem
              key={`${item.product.id}-${item.volume || ''}`}
              item={item}
              onUpdateQuantity={(productId, quantity) => updateQuantity(productId, quantity, item.volume, item.variantId)}
              onRemove={(productId) => removeItem(productId, item.volume, item.variantId)}
            />
          ))}
        </div>
        <div className="lg:sticky lg:top-24 space-y-3">
          <CartSummary />

          {!isAuthenticated ? (
            <>
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-sm text-neutral-700">
                Для оформления заказа войдите в свой аккаунт.
              </div>
              <Button
                fullWidth
                size="lg"
                className="mt-1"
                onClick={() => navigate(ROUTES.AUTH_LOGIN)}
              >
                Войти в аккаунт
              </Button>
            </>
          ) : (
            <Button
              fullWidth
              size="lg"
              className="mt-4"
              onClick={() => navigate(ROUTES.CHECKOUT)}
            >
              Оформить заказ
            </Button>
          )}
        </div>

        {/* Mobile sticky checkout / login button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-lg border-t border-neutral-200 lg:hidden z-40">
          {isAuthenticated ? (
            <Button
              fullWidth
              size="lg"
              onClick={() => navigate(ROUTES.CHECKOUT)}
            >
              Оформить заказ
            </Button>
          ) : (
            <Button
              fullWidth
              size="lg"
              onClick={() => navigate(ROUTES.AUTH_LOGIN)}
            >
              Войти для оформления
            </Button>
          )}
        </div>
        <div className="h-20 lg:hidden" /> {/* Spacer for fixed button */}
      </div>
    </div>
  )
}
