import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { ROUTES } from '@constants/routes'
import { useCancelBooking, useUserBookings, type UserBooking } from '@services/api/account'
import { useUserStore } from '@store/slices/userSlice'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, Clock, Loader2, User, Video, X } from 'lucide-react'
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

type BookingStatus = UserBooking['status']

const statusConfig: Record<BookingStatus, { label: string; color: string }> = {
  PENDING: { label: 'Ожидает подтверждения', color: 'text-amber-600 bg-amber-50' },
  CONFIRMED: { label: 'Подтверждено', color: 'text-green-600 bg-green-50' },
  COMPLETED: { label: 'Завершено', color: 'text-neutral-600 bg-neutral-100' },
  CANCELLED: { label: 'Отменено', color: 'text-red-600 bg-red-50' },
}

const typeConfig = {
  consultation: { label: 'Консультация', color: 'bg-primary-100 text-primary-700' },
  masterclass: { label: 'Мастер-класс', color: 'bg-accent-100 text-accent-700' },
}

export const BookingsPage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useUserStore()
  const { data: bookings, isLoading, error } = useUserBookings()
  const cancelMutation = useCancelBooking()
  const [filter, setFilter] = React.useState<'all' | 'upcoming' | 'past'>('all')
  const [expandedBookingId, setExpandedBookingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.AUTH_LOGIN)
    }
  }, [isAuthenticated, navigate])

  const handleCancelBooking = (id: string) => {
    if (window.confirm('Вы уверены, что хотите отменить запись?')) {
      cancelMutation.mutate(id)
    }
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
          <Calendar size={64} className="mx-auto text-neutral-300 mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">
            Ошибка загрузки записей
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

  const now = new Date()
  const allBookings = bookings ?? []

  const filteredBookings = allBookings.filter((booking) => {
    const bookingDate = new Date(`${booking.date}T${booking.time}`)
    if (filter === 'upcoming') return bookingDate >= now && booking.status !== 'CANCELLED'
    if (filter === 'past') return bookingDate < now || booking.status === 'COMPLETED'
    return true
  })

  const upcomingCount = allBookings.filter((b) => {
    const bookingDate = new Date(`${b.date}T${b.time}`)
    return bookingDate >= now && b.status !== 'CANCELLED' && b.status !== 'COMPLETED'
  }).length

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
            Мои записи
          </h1>
          {upcomingCount > 0 && (
            <span className="px-3 py-1 bg-primary-100 text-primary-700 text-sm font-medium rounded-full">
              {upcomingCount} предстоящих
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all', label: 'Все' },
            { key: 'upcoming', label: 'Предстоящие' },
            { key: 'past', label: 'Прошедшие' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredBookings.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar size={64} className="mx-auto text-neutral-300 mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              {filter === 'upcoming' ? 'Нет предстоящих записей' : 'Записей не найдено'}
            </h2>
            <p className="text-neutral-500 mb-6">
              Запишитесь на консультацию или мастер-класс
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => navigate(ROUTES.CONSULTATIONS)}>
                Консультации
              </Button>
              <Button onClick={() => navigate(ROUTES.MASTERCLASSES)}>
                Мастер-классы
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking, index) => {
              const status = statusConfig[booking.status]
              const isConsultation = !!booking.consultationId
              const type = typeConfig[isConsultation ? 'consultation' : 'masterclass']
              const bookingDate = new Date(`${booking.date}T${booking.time}`)
              const isPast = bookingDate < now || booking.status === 'COMPLETED'
              const canCancel = !isPast && booking.status !== 'CANCELLED'
              const title = booking.consultation?.title ?? booking.masterclass?.title ?? 'Запись'
              const duration = booking.consultation?.duration ?? booking.masterclass?.duration ?? 60

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className={`p-6 ${isPast ? 'opacity-75' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${type.color}`}>
                            {type.label}
                          </span>
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-neutral-900">
                          {title}
                        </h3>
                      </div>
                      {canCancel && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={cancelMutation.isPending}
                          className="text-red-600 hover:bg-red-50 hover:border-red-200"
                        >
                          <X size={16} className="mr-1" />
                          {cancelMutation.isPending ? 'Отмена...' : 'Отменить'}
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                      <div className="flex items-center gap-2 text-neutral-600">
                        <Calendar size={16} className="text-primary-600" />
                        {bookingDate.toLocaleDateString('ru-RU', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </div>
                      <div className="flex items-center gap-2 text-neutral-600">
                        <Clock size={16} className="text-primary-600" />
                        {booking.time} ({duration} мин)
                      </div>
                      <div className="flex items-center gap-2 text-neutral-600">
                        <User size={16} className="text-primary-600" />
                        {booking.participants} {booking.participants === 1 ? 'участник' : 'участника'}
                      </div>
                      <div className="flex items-center gap-2 text-neutral-600">
                        <span className="font-medium text-primary-600">
                          {booking.totalPrice.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    </div>

                    {booking.notes && (
                      <div className="mt-3 p-3 bg-neutral-50 rounded-xl text-sm text-neutral-600">
                        {booking.notes}
                      </div>
                    )}

                    {booking.status === 'CONFIRMED' && !isPast && (
                      <div className="mt-4 pt-4 border-t border-neutral-100">
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() =>
                            setExpandedBookingId(
                              expandedBookingId === booking.id ? null : booking.id,
                            )
                          }
                        >
                          <Video size={16} />
                          {expandedBookingId === booking.id ? 'Скрыть' : 'Подробнее'}
                        </Button>
                        {expandedBookingId === booking.id && (
                          <div className="mt-3 text-sm text-neutral-600">
                            <p>
                              В день записи мы пришлем подтверждение и детали консультации
                              по основным контактам аккаунта.
                            </p>
                            {booking.notes && (
                              <p className="mt-1">Дополнительная информация: {booking.notes}</p>
                            )}
                          </div>
                        )}
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
