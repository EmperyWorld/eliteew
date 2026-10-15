import React from 'react'
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  MapPin,
  XCircle,
  CreditCard,
  Loader2
} from 'lucide-react'

interface OrderStatusTimelineProps {
  currentStatus: string
  paymentStatus: string
  createdAt: string
  onStatusChange?: (status: string) => void
  isUpdating?: boolean
}

const STATUS_FLOW = [
  { key: 'PENDING', label: 'Новый', icon: Clock, color: 'amber' },
  { key: 'CONFIRMED', label: 'Подтверждён', icon: CheckCircle2, color: 'blue' },
  { key: 'PROCESSING', label: 'В обработке', icon: Package, color: 'purple' },
  { key: 'SHIPPED', label: 'Отправлен', icon: Truck, color: 'indigo' },
  { key: 'DELIVERED', label: 'Доставлен', icon: MapPin, color: 'emerald' },
]

const colorClasses: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    ring: 'ring-amber-500',
    dot: 'bg-amber-500'
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    ring: 'ring-blue-500',
    dot: 'bg-blue-500'
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-400',
    ring: 'ring-purple-500',
    dot: 'bg-purple-500'
  },
  indigo: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-700 dark:text-indigo-400',
    ring: 'ring-indigo-500',
    dot: 'bg-indigo-500'
  },
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'ring-emerald-500',
    dot: 'bg-emerald-500'
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    ring: 'ring-red-500',
    dot: 'bg-red-500'
  },
}

export const OrderStatusTimeline: React.FC<OrderStatusTimelineProps> = ({
  currentStatus,
  paymentStatus,
  createdAt,
  onStatusChange,
  isUpdating
}) => {
  const isCancelled = currentStatus === 'CANCELLED'
  const currentIndex = STATUS_FLOW.findIndex(s => s.key === currentStatus)

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isCancelled) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400">Заказ отменён</p>
            <p className="text-sm text-red-600/70 dark:text-red-400/70">
              Создан: {formatDate(createdAt)}
            </p>
          </div>
        </div>
        {onStatusChange && (
          <button
            onClick={() => onStatusChange('PENDING')}
            disabled={isUpdating}
            className="mt-3 w-full py-2 px-3 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Восстановить заказ'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-5 left-5 right-5 h-1 bg-neutral-200 dark:bg-slate-700 rounded-full" />
        <div
          className="absolute top-5 left-5 h-1 bg-gradient-to-r from-emerald-500 to-primary-500 rounded-full transition-all duration-500"
          style={{ width: `calc(${(currentIndex / (STATUS_FLOW.length - 1)) * 100}% - 2.5rem)` }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {STATUS_FLOW.map((step, index) => {
            const isCompleted = index <= currentIndex
            const isCurrent = index === currentIndex
            const colors = colorClasses[step.color]
            const Icon = step.icon

            return (
              <button
                key={step.key}
                onClick={() => onStatusChange?.(step.key)}
                disabled={!onStatusChange || isUpdating}
                className={`
                  flex flex-col items-center gap-2 group transition-all
                  ${onStatusChange ? 'cursor-pointer' : 'cursor-default'}
                `}
              >
                <div className={`
                  relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${isCompleted
                    ? `${colors.bg} ${colors.text} ring-2 ${colors.ring} ring-offset-2 dark:ring-offset-slate-900`
                    : 'bg-neutral-100 dark:bg-slate-800 text-neutral-400 dark:text-slate-500'
                  }
                  ${isCurrent ? 'scale-110 shadow-lg' : ''}
                  ${onStatusChange ? 'group-hover:scale-105' : ''}
                `}>
                  {isUpdating && isCurrent ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}

                  {/* Pulse animation for current */}
                  {isCurrent && (
                    <span className={`absolute inset-0 rounded-full ${colors.bg} animate-ping opacity-50`} />
                  )}
                </div>

                <span className={`
                  text-xs font-medium text-center leading-tight max-w-16
                  ${isCompleted ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-slate-500'}
                `}>
                  {step.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Payment status */}
      <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-slate-800/50 rounded-xl">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-neutral-500 dark:text-slate-400" />
          <span className="text-sm text-neutral-600 dark:text-slate-400">Оплата:</span>
        </div>
        <span className={`
          px-2.5 py-1 rounded-full text-xs font-semibold
          ${paymentStatus === 'PAID'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : paymentStatus === 'REFUNDED'
              ? 'bg-neutral-100 text-neutral-600 dark:bg-slate-700 dark:text-slate-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          }
        `}>
          {paymentStatus === 'PAID' ? '✓ Оплачен' : paymentStatus === 'REFUNDED' ? 'Возврат' : 'Ожидает оплаты'}
        </span>
      </div>

      {/* Cancel button */}
      {onStatusChange && currentStatus !== 'DELIVERED' && (
        <button
          onClick={() => onStatusChange('CANCELLED')}
          disabled={isUpdating}
          className="w-full py-2 px-3 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          Отменить заказ
        </button>
      )}
    </div>
  )
}
