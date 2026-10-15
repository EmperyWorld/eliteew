import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { ROUTES } from '@constants/routes'
import { useUserOrders, type UserOrder } from '@services/api/account'
import { useUserStore } from '@store/slices/userSlice'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, Clock, Loader2, Package, ShoppingBag, Truck, XCircle } from 'lucide-react'
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

const statusConfig: Record<UserOrder['status'], { label: string; icon: typeof Clock; color: string }> = {
  PENDING: { label: 'Ожидает', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  PROCESSING: { label: 'В обработке', icon: Package, color: 'text-blue-600 bg-blue-50' },
  SHIPPED: { label: 'В доставке', icon: Truck, color: 'text-indigo-600 bg-indigo-50' },
  DELIVERED: { label: 'Доставлен', icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  CANCELLED: { label: 'Отменён', icon: XCircle, color: 'text-red-600 bg-red-50' },
}

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useUserStore()
  const { data: orders, isLoading, error } = useUserOrders()
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.AUTH_LOGIN)
    }
  }, [isAuthenticated, navigate])

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
          <ShoppingBag size={64} className="mx-auto text-neutral-300 mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">
            Ошибка загрузки заказов
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
            Мои заказы
          </h1>
        </div>

        {!orders || orders.length === 0 ? (
          <Card className="p-12 text-center">
            <ShoppingBag size={64} className="mx-auto text-neutral-300 mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              У вас пока нет заказов
            </h2>
            <p className="text-neutral-500 mb-6">
              Самое время выбрать что-нибудь особенное
            </p>
            <Button onClick={() => navigate(ROUTES.SHOP)}>
              Перейти в магазин
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => {
              const status = statusConfig[order.status]
              const StatusIcon = status.icon

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <Package size={20} className="text-primary-600" />
                          <span className="font-semibold text-neutral-900">{order.orderNumber}</span>
                        </div>
                        <p className="text-sm text-neutral-500 mt-1">
                          {new Date(order.createdAt).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${status.color}`}>
                        <StatusIcon size={16} />
                        {status.label}
                      </div>
                    </div>

                    <div className="border-t border-neutral-100 pt-4">
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-neutral-600">
                              {item.product.name} × {item.quantity}
                            </span>
                            <span className="text-neutral-900 font-medium">
                              {(item.price * item.quantity).toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-neutral-100">
                        <span className="font-medium text-neutral-900">Итого</span>
                        <span className="text-lg font-semibold text-primary-600">
                          {order.totalPrice.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() =>
                          setExpandedOrderId(expandedOrderId === order.id ? null : order.id)
                        }
                      >
                        {expandedOrderId === order.id ? 'Скрыть' : 'Подробнее'}
                      </Button>
                      {order.status === 'DELIVERED' && (
                        <Button variant="outline" size="sm" className="flex-1">
                          Повторить заказ
                        </Button>
                      )}
                    </div>

                    {expandedOrderId === order.id && (
                      <div className="mt-4 pt-4 border-t border-neutral-100 text-sm text-neutral-600 space-y-1">
                        <p>
                          Способ доставки:{' '}
                          {order.deliveryMethod === 'pickup' ? 'Самовывоз' : 'Доставка курьером'}
                        </p>
                        {order.deliveryAddress && (
                          <p>Адрес: {order.deliveryAddress}</p>
                        )}
                        <p>
                          Способ оплаты:{' '}
                          {order.paymentMethod === 'card'
                            ? 'Картой'
                            : order.paymentMethod === 'cash'
                            ? 'Наличными'
                            : 'Перевод'}
                        </p>
                        {order.notes && <p>Комментарий: {order.notes}</p>}
                      </div>
                    )}
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
