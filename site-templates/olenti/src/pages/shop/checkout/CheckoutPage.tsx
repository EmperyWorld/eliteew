import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { Input } from '@components/atoms/Input'
import { ROUTES } from '@constants/routes'
import { apiClient } from '@services/api/client'
import { useCartStore } from '@store/slices/cartSlice'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import { useUserStore } from '@store/slices/userSlice'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, CreditCard, ShoppingBag, Truck } from 'lucide-react'
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

type DeliveryMethod = 'pickup' | 'delivery'
type PaymentMethod = 'card' | 'cash' | 'transfer'

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate()
  const { items, getTotal, clearCart } = useCartStore()
  const siteSettings = useSiteSettingsStore((state) => state.siteSettings)
  const { user } = useUserStore()
  const pickupAddress = siteSettings.contactAddress || 'Адрес самовывоза уточняется'
  const deliveryCity =
    siteSettings.contactAddress.split(',').map((part) => part.trim()).find(Boolean) || undefined

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    deliveryMethod: 'pickup' as DeliveryMethod,
    address: '',
    paymentMethod: 'card' as PaymentMethod,
    comment: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const customerName = formData.name.trim() || user?.name || ''
      if (!customerName) {
        alert('Пожалуйста, укажите, как к вам обращаться.')
        setIsSubmitting(false)
        return
      }

      // Подготавливаем данные для API
      const orderData = {
        customerName,
        // Email больше не спрашиваем при оформлении, используем аккаунт и телефон для связи.
        customerPhone: formData.phone || user?.phone || undefined,
        deliveryMethod: formData.deliveryMethod,
        deliveryAddress: formData.deliveryMethod === 'delivery' ? formData.address : undefined,
        deliveryCity: formData.deliveryMethod === 'delivery' ? deliveryCity : undefined,
        paymentMethod: formData.paymentMethod,
        notes: formData.comment || undefined,
        items: items.map(item => ({
          productId: item.product.id,
          variantId: item.variantId,
          volume: item.volume,
          quantity: item.quantity,
        })),
      }

      await apiClient.post('/orders', orderData)
      setIsSubmitted(true)
      clearCart()
    } catch (error: unknown) {
      console.error('Order error:', error)

      const response = (error as { response?: { status?: number; data?: { message?: string } } }).response

      // Handle stale cart (products not found)
      if (response?.status === 404) {
        alert('Некоторые товары в вашей корзине больше не доступны. Корзина будет очищена. Пожалуйста, выберите товары заново.')
        clearCart()
        navigate(ROUTES.SHOP)
        return
      }

      // Handle validation errors
      if (response?.data?.message) {
        alert(`Ошибка: ${response.data.message}`)
      } else {
        alert('Ошибка при оформлении заказа. Попробуйте ещё раз.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (items.length === 0 && !isSubmitted) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <ShoppingBag size={64} className="mx-auto text-neutral-300 mb-4" />
        <h1 className="text-2xl font-display font-semibold text-neutral-900 mb-4">
          Корзина пуста
        </h1>
        <p className="text-neutral-600 mb-6">
          Добавьте товары в корзину, чтобы оформить заказ
        </p>
        <Button onClick={() => navigate(ROUTES.SHOP)}>
          Перейти в магазин
        </Button>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-md mx-auto text-center"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} className="text-green-600" />
          </div>
          <h1 className="text-3xl font-display font-semibold text-neutral-900 mb-4">
            Заказ оформлен!
          </h1>
          <p className="text-neutral-600 mb-8">
            Мы свяжемся с вами в ближайшее время для подтверждения заказа и уточнения деталей доставки.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate(ROUTES.HOME)}>
              На главную
            </Button>
            <Button onClick={() => navigate(ROUTES.SHOP)}>
              Продолжить покупки
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <Button
        variant="ghost"
        onClick={() => navigate(ROUTES.CART)}
        className="mb-6 inline-flex items-center gap-2"
      >
        <ArrowLeft size={18} />
        Вернуться в корзину
      </Button>

      <h1 className="text-3xl sm:text-4xl font-display font-bold text-neutral-900 mb-8">
        Оформление заказа
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr_380px]">
          {/* Form */}
          <div className="space-y-6">
            {/* Contact info */}
            <Card className="p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-neutral-900 mb-3 sm:mb-4">Контактные данные</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Ваше имя
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Как к вам обращаться"
                  />
                  {user && (
                    <p className="mt-1 text-xs text-neutral-400">
                      Имя подставлено из профиля аккаунта, вы можете изменить его при необходимости.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Телефон (необязательно)
                  </label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
              </div>
            </Card>

            {/* Delivery */}
            <Card className="p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-neutral-900 mb-3 sm:mb-4">Способ получения</h2>
              <div className="space-y-3">
                <label
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    formData.deliveryMethod === 'pickup'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value="pickup"
                    checked={formData.deliveryMethod === 'pickup'}
                    onChange={() => handleChange('deliveryMethod', 'pickup')}
                    className="w-4 h-4 text-primary-600"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-neutral-900">Самовывоз</span>
                    <p className="text-sm text-neutral-500">{pickupAddress}</p>
                  </div>
                  <span className="text-green-600 font-medium">Бесплатно</span>
                </label>

                <label
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    formData.deliveryMethod === 'delivery'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value="delivery"
                    checked={formData.deliveryMethod === 'delivery'}
                    onChange={() => handleChange('deliveryMethod', 'delivery')}
                    className="w-4 h-4 text-primary-600"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-neutral-900">Доставка</span>
                    <p className="text-sm text-neutral-500">Географию доставки настройте под ваш проект</p>
                  </div>
                  <span className="text-neutral-600 font-medium">По договорённости</span>
                </label>
              </div>

              {formData.deliveryMethod === 'delivery' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Адрес доставки *
                  </label>
                  <Input
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Город, улица, дом, квартира"
                    required={formData.deliveryMethod === 'delivery'}
                  />
                </div>
              )}
            </Card>

            {/* Payment */}
            <Card className="p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-neutral-900 mb-3 sm:mb-4">Способ оплаты</h2>
              <div className="space-y-3">
                <label
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    formData.paymentMethod === 'card'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={formData.paymentMethod === 'card'}
                    onChange={() => handleChange('paymentMethod', 'card')}
                    className="w-4 h-4 text-primary-600"
                  />
                  <CreditCard size={20} className="text-neutral-400" />
                  <span className="font-medium text-neutral-900">Банковская карта</span>
                </label>

                <label
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    formData.paymentMethod === 'transfer'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="transfer"
                    checked={formData.paymentMethod === 'transfer'}
                    onChange={() => handleChange('paymentMethod', 'transfer')}
                    className="w-4 h-4 text-primary-600"
                  />
                  <Truck size={20} className="text-neutral-400" />
                  <span className="font-medium text-neutral-900">Перевод на карту</span>
                </label>

                <label
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    formData.paymentMethod === 'cash'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="cash"
                    checked={formData.paymentMethod === 'cash'}
                    onChange={() => handleChange('paymentMethod', 'cash')}
                    className="w-4 h-4 text-primary-600"
                  />
                  <ShoppingBag size={20} className="text-neutral-400" />
                  <span className="font-medium text-neutral-900">Наличными при получении</span>
                </label>
              </div>
            </Card>

            {/* Comment */}
            <Card className="p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-neutral-900 mb-3 sm:mb-4">Комментарий к заказу</h2>
              <textarea
                value={formData.comment}
                onChange={(e) => handleChange('comment', e.target.value)}
                placeholder="Особые пожелания или вопросы..."
                rows={3}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 transition focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </Card>
          </div>

          {/* Order summary */}
          <div>
            <Card className="p-4 sm:p-6 lg:sticky lg:top-24">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Ваш заказ</h2>

              <div className="space-y-4 mb-6">
                {items.map((item, index) => (
                  <div key={`${item.product.id}-${item.volume}-${index}`} className="flex gap-4">
                    <div className="w-16 h-16 bg-neutral-100 rounded-lg shrink-0">
                      {item.product.image && (
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-neutral-900 truncate">{item.product.name}</h4>
                      <p className="text-sm text-neutral-500">{item.volume}</p>
                      <p className="text-sm text-neutral-600">
                        {item.quantity} × {item.product.price.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-200 pt-4 space-y-2">
                <div className="flex justify-between text-neutral-600">
                  <span>Товары ({items.length})</span>
                  <span>{getTotal().toLocaleString('ru-RU')} ₽</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Доставка</span>
                  <span>{formData.deliveryMethod === 'pickup' ? 'Бесплатно' : 'По договорённости'}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold text-neutral-900 pt-2 border-t border-neutral-200">
                  <span>Итого</span>
                  <span>{getTotal().toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>

              <Button
                type="submit"
                fullWidth
                size="lg"
                className="mt-6"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Оформление...' : 'Оформить заказ'}
              </Button>

              <p className="text-xs text-neutral-500 text-center mt-4">
                Нажимая кнопку, вы соглашаетесь с{' '}
                <Link to="/privacy" className="text-primary-600 hover:underline">
                  политикой конфиденциальности
                </Link>
              </p>
            </Card>

            {/* Mobile sticky submit */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-lg border-t border-neutral-200 lg:hidden z-40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-600">Итого:</span>
                <span className="text-lg font-semibold text-neutral-900">{getTotal().toLocaleString('ru-RU')} ₽</span>
              </div>
              <Button
                type="submit"
                fullWidth
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Оформление...' : 'Оформить заказ'}
              </Button>
            </div>
            <div className="h-28 lg:hidden" />
          </div>
        </div>
      </form>
    </div>
  )
}
