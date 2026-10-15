import React from 'react'
import { Check, X, Clock, Phone, Mail, Calendar, Users } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { Button } from '@components/atoms/Button'
import type { AdminBookingStatus, AdminBookingWithSlotInfo } from '@services/api/bookings'

const statusConfig: Record<
  AdminBookingStatus,
  { label: string; color: string; bgColor: string; icon: typeof Clock }
> = {
  pending: {
    label: 'Ожидает',
    color: 'text-amber-700 dark:text-amber-200',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    icon: Clock,
  },
  confirmed: {
    label: 'Подтверждено',
    color: 'text-emerald-700 dark:text-emerald-200',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: Check,
  },
  cancelled: {
    label: 'Отменено',
    color: 'text-red-700 dark:text-red-200',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: X,
  },
  completed: {
    label: 'Завершено',
    color: 'text-neutral-600 dark:text-slate-300',
    bgColor: 'bg-neutral-100 dark:bg-slate-800',
    icon: Check,
  },
}

interface BookingCardProps {
  booking: AdminBookingWithSlotInfo
  onUpdateStatus: (id: string, status: AdminBookingStatus) => void
  onNavigateToSchedule: (dateRaw: string) => void
  onDuplicate?: () => void
  tags?: string[]
  onToggleTag?: (tag: string) => void
  note?: string
  onChangeNote?: (val: string) => void
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onUpdateStatus,
  onNavigateToSchedule,
  onDuplicate,
  tags = [],
  onToggleTag,
  note = '',
  onChangeNote,
}) => {
  const status = statusConfig[booking.status]
  const StatusIcon = status.icon
  const isPending = booking.status === 'pending'

  return (
    <Card
      className={`overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] group ${
        isPending ? 'ring-2 ring-amber-200 dark:ring-amber-700/60 shadow-amber-100/50 dark:shadow-amber-900/20' : ''
      } bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700`}
    >
      {/* Header with status */}
      <div className={`px-6 py-4 border-b border-neutral-100 dark:border-slate-700/50 transition-colors duration-200 ${
        isPending
          ? 'bg-gradient-to-r from-amber-50/80 via-amber-50/50 to-transparent dark:from-amber-900/15 dark:via-amber-900/10 dark:to-transparent'
          : 'bg-gradient-to-r from-neutral-50/80 via-neutral-50/50 to-transparent dark:from-slate-800/50 dark:via-slate-800/30 dark:to-transparent'
      }`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-lg bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm group-hover:bg-white dark:group-hover:bg-slate-700 transition-all duration-200 shrink-0">
              <Users size={16} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {booking.customerName}
              </h3>
            </div>
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all duration-200 ${status.bgColor} ${status.color} shrink-0`}>
              <StatusIcon size={12} />
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-slate-400 bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-slate-600 shrink-0">
            <Calendar size={14} className="text-primary-500 dark:text-primary-400 shrink-0" />
            <span className="font-semibold text-neutral-900 dark:text-white whitespace-nowrap">{booking.slotInfo.date}</span>
            <span className="text-neutral-300 dark:text-slate-600 shrink-0">•</span>
            <span className="font-semibold text-neutral-900 dark:text-white whitespace-nowrap">{booking.slotInfo.time}</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 gap-6 max-w-full">
          {/* Customer info section */}
          <div className="lg:col-span-1 space-y-5 min-w-0">
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <div className="w-1 h-4 bg-primary-500 rounded-full" />
                Контакты
              </h4>
              <div className="space-y-3">
                <a
                  href={`tel:${booking.customerPhone}`}
                  className="flex items-center gap-3 text-sm text-neutral-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-200 group p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20"
                >
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/30 group-hover:from-primary-200 group-hover:to-primary-100 dark:group-hover:from-primary-800/50 dark:group-hover:to-primary-700/40 transition-all duration-200 shadow-sm group-hover:shadow-md">
                    <Phone size={16} className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <span className="font-semibold">{booking.customerPhone}</span>
                </a>
                {booking.customerEmail && (
                  <a
                    href={`mailto:${booking.customerEmail}`}
                    className="flex items-center gap-3 text-sm text-neutral-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-200 group p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20"
                  >
                    <div className="p-2 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/30 group-hover:from-primary-200 group-hover:to-primary-100 dark:group-hover:from-primary-800/50 dark:group-hover:to-primary-700/40 transition-all duration-200 shadow-sm group-hover:shadow-md">
                      <Mail size={16} className="text-primary-600 dark:text-primary-400" />
                    </div>
                    <span className="font-semibold truncate">{booking.customerEmail}</span>
                  </a>
                )}
              </div>
            </div>

            {booking.notes && (
              <div>
                <h4 className="text-xs font-semibold text-neutral-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-amber-500 rounded-full" />
                  Заметка клиента
                </h4>
                <div className="relative">
                  <div className="absolute top-2 left-3 text-2xl text-neutral-200 dark:text-slate-700">"</div>
                  <p className="text-sm text-neutral-700 dark:text-slate-300 italic bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 p-4 pl-8 rounded-lg border border-amber-200 dark:border-amber-800/30 shadow-sm">
                    {booking.notes}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Event info section */}
          <div className="lg:col-span-1 min-w-0">
            <h4 className="text-xs font-semibold text-neutral-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <div className={`w-1 h-4 rounded-full shrink-0 ${
                booking.slotInfo.type === 'consultation' ? 'bg-purple-500' : 'bg-blue-500'
              }`} />
              Услуга
            </h4>
            <div
              className={`p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] min-w-0 ${
                booking.slotInfo.type === 'consultation'
                  ? 'bg-gradient-to-br from-purple-50 via-purple-100/50 to-purple-50/30 dark:from-purple-900/20 dark:via-purple-900/10 dark:to-purple-900/5 border-purple-300 dark:border-purple-800/40 shadow-purple-100/50 dark:shadow-purple-900/20'
                  : 'bg-gradient-to-br from-blue-50 via-blue-100/50 to-blue-50/30 dark:from-blue-900/20 dark:via-blue-900/10 dark:to-blue-900/5 border-blue-300 dark:border-blue-800/40 shadow-blue-100/50 dark:shadow-blue-900/20'
              }`}
            >
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap shrink-0 ${
                    booking.slotInfo.type === 'consultation'
                      ? 'bg-purple-200/90 text-purple-800 dark:bg-purple-900/50 dark:text-purple-100'
                      : 'bg-blue-200/90 text-blue-800 dark:bg-blue-900/50 dark:text-blue-100'
                  }`}
                >
                  {booking.slotInfo.type === 'consultation' ? 'Консультация' : 'Мастер-класс'}
                </span>
                {booking.participants > 1 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm text-xs font-semibold text-neutral-700 dark:text-slate-300 border border-neutral-200 dark:border-slate-600 shrink-0">
                    <Users size={12} className="shrink-0" />
                    <span className="whitespace-nowrap">{booking.participants}</span>
                  </div>
                )}
              </div>
              <h4 className="font-bold text-lg text-neutral-900 dark:text-white line-clamp-2 leading-tight break-words">
                {booking.slotInfo.title}
              </h4>
            </div>
          </div>

          {/* Actions section */}
          <div className="lg:col-span-1 min-w-0 flex flex-col">
            <h4 className="text-xs font-semibold text-neutral-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2 shrink-0">
              <div className="w-1 h-4 bg-emerald-500 rounded-full shrink-0" />
              Действия
            </h4>
            <div className="space-y-2.5 flex-1">
              {booking.status === 'pending' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => onUpdateStatus(booking.id, 'confirmed')}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    aria-label="Подтвердить запись"
                  >
                    <Check size={14} className="mr-1.5" />
                    Подтвердить
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateStatus(booking.id, 'cancelled')}
                    className="w-full text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:border-red-800/60 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    aria-label="Отменить запись"
                  >
                    <X size={14} className="mr-1.5" />
                    Отменить
                  </Button>
                </>
              )}
              {booking.status === 'confirmed' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => onUpdateStatus(booking.id, 'completed')}
                    className="w-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    aria-label="Завершить запись"
                  >
                    <Check size={14} className="mr-1.5" />
                    Завершить
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateStatus(booking.id, 'cancelled')}
                    className="w-full text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:border-red-800/60 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    aria-label="Отменить запись"
                  >
                    Отменить
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                onClick={() => onNavigateToSchedule(booking.dateRaw)}
                aria-label="Перейти в планировщик"
              >
                В планировщик
              </Button>
              {onDuplicate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-neutral-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  onClick={onDuplicate}
                >
                  Дублировать
                </Button>
              )}
              {(booking.status === 'completed' || booking.status === 'cancelled') && (
                <p className="text-[10px] text-neutral-400 dark:text-slate-500 text-center pt-1">
                  Обновлено: {new Date(booking.updatedAt).toLocaleDateString('ru-RU')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tags + note section */}
        {(onToggleTag || onChangeNote) && (
          <div className="mt-6 pt-6 border-t-2 border-neutral-100 dark:border-slate-700/50 space-y-4">
            {onToggleTag && (
              <div>
                <h4 className="text-xs font-semibold text-neutral-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-violet-500 rounded-full" />
                  Теги
                </h4>
                <div className="flex flex-wrap gap-2">
                  {['VIP', 'Опоздания', 'No-show', 'Перезвонить', 'Приоритет'].map((tag) => {
                    const active = tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        onClick={() => onToggleTag(tag)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95 ${
                          active
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 border-primary-300 dark:border-primary-700 shadow-md shadow-primary-200/50 dark:shadow-primary-900/30'
                            : 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-300 border-transparent hover:border-neutral-300 dark:hover:border-slate-600 hover:bg-neutral-200 dark:hover:bg-slate-600 hover:shadow-sm'
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {onChangeNote && (
              <div>
                <h4 className="text-xs font-semibold text-neutral-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-cyan-500 rounded-full" />
                  Заметка администратора
                </h4>
                <textarea
                  className="w-full text-sm rounded-lg border-2 border-neutral-200 dark:border-slate-700 bg-neutral-50 dark:bg-slate-900/40 text-neutral-700 dark:text-slate-200 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 dark:focus:ring-primary-700 focus:border-primary-400 dark:focus:border-primary-600 transition-all duration-200 placeholder:text-neutral-400 dark:placeholder:text-slate-500"
                  rows={3}
                  placeholder="Добавьте заметку по клиенту..."
                  value={note}
                  onChange={(e) => onChangeNote(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
