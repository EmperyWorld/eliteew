import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import type { ScheduleSlot } from '@typings/admin'
import { CheckCircle2, Clock, Edit, Trash2 } from 'lucide-react'
import React from 'react'

const PRIORITY_COLORS = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
} as const

const STATUS_COLORS = {
  pending: 'bg-neutral-100 text-neutral-600',
  done: 'bg-green-100 text-green-700 line-through',
  cancelled: 'bg-red-50 text-red-400',
  available: 'bg-green-100 text-green-700',
  full: 'bg-red-100 text-red-700',
} as const

interface ScheduleListProps {
  slots: ScheduleSlot[]
  onEdit: (slot: ScheduleSlot) => void
  onDelete: (id: string) => void
  onToggleTaskStatus: (slot: ScheduleSlot) => void
  getEntityTitle: (type: string, id: string) => string
}

export const ScheduleList: React.FC<ScheduleListProps> = ({
  slots,
  onEdit,
  onDelete,
  onToggleTaskStatus,
  getEntityTitle,
}) => {
  const sortedSlots = React.useMemo(() => {
    return [...slots].sort((a, b) =>
      new Date(a.date + 'T' + a.startTime).getTime() - new Date(b.date + 'T' + b.startTime).getTime()
    )
  }, [slots])

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Все задачи и события</h2>
      </div>

      <div className="space-y-3">
        {sortedSlots.map(slot => {
          const isDone = slot.status === 'done'
          const isFull = slot.entityType !== 'task' && slot.currentParticipants >= slot.maxParticipants

          return (
            <div key={slot.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${isDone ? 'bg-neutral-50 dark:bg-slate-800/50 border-neutral-100 dark:border-slate-700 opacity-70' : 'bg-white dark:bg-slate-800 border-neutral-100 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-700 hover:shadow-sm'}`}>
              <div className="w-16 text-center">
                <div className="text-sm font-bold text-neutral-900 dark:text-white">
                  {new Date(slot.date).toLocaleDateString('ru-RU', { day: 'numeric' })}
                </div>
                <div className="text-xs text-neutral-500 dark:text-slate-400 uppercase">
                  {new Date(slot.date).toLocaleDateString('ru-RU', { month: 'short' })}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    slot.entityType === 'task'
                      ? 'bg-neutral-100 text-neutral-600'
                      : slot.entityType === 'consultation'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}>
                    {slot.entityType === 'task' ? 'Задача' : slot.entityType === 'consultation' ? 'Консультация' : 'Мастер-класс'}
                  </span>
                  {slot.priority && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[slot.priority] || PRIORITY_COLORS.medium}`}>
                      {slot.priority === 'high' ? 'Высокий' : slot.priority === 'low' ? 'Низкий' : 'Средний'}
                    </span>
                  )}
                  {slot.status && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[slot.status] || STATUS_COLORS.pending}`}>
                      {slot.status === 'done'
                        ? 'Готово'
                        : slot.status === 'cancelled'
                          ? 'Отменено'
                          : slot.status === 'full'
                            ? 'Заполнено'
                            : slot.status === 'available'
                              ? 'Доступно'
                              : 'В работе'}
                    </span>
                  )}
                  {slot.entityType !== 'task' && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isFull ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                      {slot.currentParticipants}/{slot.maxParticipants}
                    </span>
                  )}
                  <span className="text-xs text-neutral-500 dark:text-slate-400 flex items-center gap-1 ml-auto">
                    <Clock size={12} />
                    {slot.startTime} - {slot.endTime}
                  </span>
                </div>
                <h4 className={`font-medium text-neutral-900 dark:text-white truncate ${isDone ? 'line-through text-neutral-500 dark:text-slate-500' : ''}`}>
                  {slot.title || getEntityTitle(slot.entityType, slot.entityId)}
                </h4>
                {slot.description && (
                  <p className="text-sm text-neutral-500 dark:text-slate-400 truncate mt-0.5">
                    {slot.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {slot.entityType === 'task' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={isDone ? 'text-green-600' : 'text-neutral-400 hover:text-green-600'}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleTaskStatus(slot)
                    }}
                    aria-label={isDone ? 'Отменить выполнение' : 'Отметить выполненным'}
                  >
                    <CheckCircle2 size={18} className={isDone ? 'fill-current' : ''} />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onEdit(slot)} aria-label="Редактировать">
                  <Edit size={16} />
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(slot.id)} aria-label="Удалить">
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          )
        })}

        {slots.length === 0 && (
          <div className="text-center py-12 text-neutral-500 dark:text-slate-400">
            Список пуст
          </div>
        )}
      </div>
    </Card>
  )
}
