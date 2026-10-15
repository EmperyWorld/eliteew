import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { Input } from '@components/atoms/Input'
import { ROUTES } from '@constants/routes'
import {
    useAccountCounts,
    useUpdateProfile,
    useUserBookings,
    useUserOrders,
    type UserBooking,
    type UserOrder,
} from '@services/api/account'
import { useUserStore } from '@store/slices/userSlice'
import { motion } from 'framer-motion'
import { Calendar, Heart, LogOut, Mail, Phone, ShoppingBag, User } from 'lucide-react'
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useUserStore()
  const updateProfileMutation = useUpdateProfile()
  const counts = useAccountCounts()
  const { data: orders } = useUserOrders()
  const { data: bookings } = useUserBookings()

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
  })

  // Sync formData with user when user changes
  React.useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
      })
    }
  }, [user])

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.AUTH_LOGIN)
    }
  }, [isAuthenticated, navigate])

  if (!user) {
    return null
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        name: formData.name,
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update profile:', error)
    }
  }

  const handleLogout = () => {
    logout()
    navigate(ROUTES.HOME)
  }

  const menuItems = [
    { icon: ShoppingBag, label: 'Мои заказы', to: ROUTES.ACCOUNT_ORDERS, count: counts.orders || undefined },
    { icon: Calendar, label: 'Мои записи', to: '/account/bookings', count: counts.bookings || undefined },
    { icon: Heart, label: 'Избранное', to: ROUTES.ACCOUNT_FAVORITES, count: counts.favorites || undefined },
  ]

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-neutral-900 mb-8">
          Личный кабинет
        </h1>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <div className="space-y-6">
            {/* User card */}
            <Card className="p-4 sm:p-6 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <User size={40} className="text-primary-600" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900">{user.name}</h2>
              <p className="text-neutral-500 text-sm">
                {user.email}
              </p>
              <p className="text-xs text-neutral-400 mt-2">
                С нами с {new Date(user.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
              </p>
            </Card>

            {/* Menu */}
            <Card className="p-2">
              <nav className="space-y-1">
                {menuItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between px-4 py-3 rounded-xl text-neutral-700 hover:bg-neutral-100 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <item.icon size={20} className="text-neutral-400" />
                      {item.label}
                    </span>
                    {item.count !== undefined && (
                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                        {item.count}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            </Card>

            {/* Logout */}
            <Button
              variant="outline"
              fullWidth
              onClick={handleLogout}
              className="text-red-600 hover:bg-red-50 hover:border-red-200"
            >
              <LogOut size={18} className="mr-2" />
              Выйти
            </Button>
          </div>

          {/* Main content */}
          <div className="space-y-6">
            {/* Profile info */}
            <Card className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-semibold text-neutral-900">Личные данные</h2>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="w-full sm:w-auto">
                    Редактировать
                  </Button>
                ) : (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                      Отмена
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={updateProfileMutation.isPending}>
                      {updateProfileMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    <User size={16} className="inline mr-2" />
                    Имя
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                    />
                  ) : (
                    <p className="text-neutral-900">{user.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
                    <Mail size={16} className="text-primary-600" />
                    <span>Email</span>
                  </label>
                  <p className="text-neutral-900">{user.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
                    <Phone size={16} className="text-primary-600" />
                    <span>Телефон</span>
                  </label>
                  <p className="text-neutral-900">{user.phone || 'Не указан'}</p>
                </div>
              </div>
            </Card>

            {/* Recent orders preview */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900">Последние заказы</h2>
                <Link to={ROUTES.ACCOUNT_ORDERS} className="text-sm text-primary-600 hover:text-primary-700">
                  Все заказы →
                </Link>
              </div>

              {orders && orders.length > 0 ? (
                <div className="space-y-3">
                  {orders.slice(0, 3).map((order: UserOrder) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-neutral-900">Заказ #{order.orderNumber}</p>
                        <p className="text-xs text-neutral-500">
                          {new Date(order.createdAt).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-primary-600">
                          {order.totalPrice.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="text-xs text-neutral-500 capitalize">{order.status.toLowerCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-500">
                  <ShoppingBag size={48} className="mx-auto text-neutral-300 mb-4" />
                  <p>У вас пока нет заказов</p>
                  <Button variant="outline" className="mt-4" onClick={() => navigate(ROUTES.SHOP)}>
                    Перейти в магазин
                  </Button>
                </div>
              )}
            </Card>

            {/* Upcoming bookings / recent bookings preview */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900">Ближайшие записи</h2>
                <Link to="/account/bookings" className="text-sm text-primary-600 hover:text-primary-700">
                  Все записи →
                </Link>
              </div>

              {(() => {
                const list = bookings?.slice(0, 3) ?? []

                if (list.length === 0) {
                  return (
                    <div className="text-center py-8 text-neutral-500">
                      <Calendar size={48} className="mx-auto text-neutral-300 mb-4" />
                      <p>У вас пока нет записей</p>
                      <div className="flex gap-4 justify-center mt-4">
                        <Button variant="outline" onClick={() => navigate(ROUTES.CONSULTATIONS)}>
                          Консультации
                        </Button>
                        <Button variant="outline" onClick={() => navigate(ROUTES.MASTERCLASSES)}>
                          Мастер-классы
                        </Button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="space-y-3">
                    {list.map((booking: UserBooking) => {
                      const bookingDate = new Date(`${booking.date}T${booking.time}`)
                      const title = booking.consultation?.title ?? booking.masterclass?.title ?? 'Запись'
                      return (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-3 text-sm"
                        >
                          <div>
                            <p className="font-medium text-neutral-900">{title}</p>
                            <p className="text-xs text-neutral-500">
                              {bookingDate.toLocaleDateString('ru-RU', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                              })}{' '}
                              в {booking.time}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-primary-600">
                              {booking.totalPrice.toLocaleString('ru-RU')} ₽
                            </p>
                            <p className="text-xs text-neutral-500 capitalize">
                              {booking.status.toLowerCase()}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
