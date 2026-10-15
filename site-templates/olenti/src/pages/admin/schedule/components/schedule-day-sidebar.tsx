import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import type { ScheduleSlot } from '@typings/admin'
import { AlertTriangle, Calendar, Clock, Plus, Users, X } from 'lucide-react'
import React from 'react'

interface ScheduleDaySidebarProps {
  selectedDate: string | null
  slots: ScheduleSlot[]
  onAdd: (date: string) => void
  onEdit: (slot: ScheduleSlot) => void
  onDelete: (slotId: string) => void
  onToggleTaskStatus: (slot: ScheduleSlot) => void
  onBlockDay: (date: string) => void
}

export function ScheduleDaySidebar(props: ScheduleDaySidebarProps) {
  const { selectedDate, slots, onAdd, onEdit, onDelete, onToggleTaskStatus, onBlockDay } = props

  const slotsForDay = React.useMemo(
    () => (selectedDate ? slots.filter(s => s.date === selectedDate) : []),
    [selectedDate, slots]
  )
  const counts = React.useMemo(() => {
    return {
      total: slotsForDay.length,
      pending: slotsForDay.filter(s => s.status === 'pending').length,
      done: slotsForDay.filter(s => s.status === 'done').length,
    }
  }, [slotsForDay])

  const hasDayOff = React.useMemo(
    () =>
      slotsForDay.some(
        (s) =>
          s.entityType === 'task' &&
          ((s.title || '').toLowerCase().includes('выходной') || s.maxParticipants === 0),
      ),
    [slotsForDay],
  )

  return (
    <Card className="p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            {selectedDate
              ? new Date(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })
              : 'Выберите дату'}
          </h3>
          {selectedDate && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2 py-1 rounded-full text-xs bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-slate-300">
                Всего: {counts.total}
              </span>
              <span className="px-2 py-1 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200">
                В работе: {counts.pending}
              </span>
              <span className="px-2 py-1 rounded-full text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200">
                Готово: {counts.done}
              </span>
              {hasDayOff && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200">
                  <AlertTriangle size={12} />
                  Выходной день
                </span>
              )}
            </div>
          )}
        </div>
        {selectedDate && (
          <Button size="sm" onClick={() => onAdd(selectedDate)} className="h-8 text-xs">
            <Plus size={14} className="mr-1" />
            Добавить
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 -mr-2">
        {selectedDate && slotsForDay.length === 0 && (
          <div className="text-center py-8 text-neutral-500 dark:text-slate-400 text-sm">
            <Calendar className="mx-auto h-8 w-8 mb-2 opacity-20 dark:opacity-30" />
            Нет событий
          </div>
        )}

        {selectedDate && slotsForDay.map(slot => {
          const isDone = slot.status === 'done'
          const priorityColors: Record<'low' | 'medium' | 'high', string> = {
            low: 'bg-blue-100 text-blue-700',
            medium: 'bg-amber-100 text-amber-700',
            high: 'bg-red-100 text-red-700',
          }

          return (
            <div
              key={slot.id}
              className={`p-3 rounded-xl border group relative transition-all duration-200 ${
                isDone
                  ? 'bg-neutral-50 dark:bg-slate-800/50 border-neutral-100 dark:border-slate-700 opacity-70'
                  : slot.entityType === 'task'
                    ? 'bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 hover:shadow-sm'
                    : slot.entityType === 'consultation'
                      ? 'bg-purple-50/50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800 hover:shadow-sm'
                      : 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 hover:shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex gap-1 flex-wrap">
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
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColors[slot.priority] || priorityColors.medium}`}>
                      {slot.priority === 'high' ? '!' : slot.priority === 'low' ? '↓' : '•'}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(slot.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-red-400 rounded transition-all"
                  aria-label="Удалить"
                >
                  <X size={14} />
                </button>
              </div>

              <h4 className={`font-medium text-neutral-900 dark:text-white text-sm ${isDone ? 'line-through text-neutral-500 dark:text-slate-500' : ''}`}>
                {slot.title}
              </h4>
              {slot.description && (
                <p className="text-xs text-neutral-500 dark:text-slate-400 truncate mt-0.5">
                  {slot.description}
                </p>
              )}

              <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {slot.startTime}
                </span>
                {slot.entityType !== 'task' && (
                  <span className={`flex items-center gap-1 ${slot.currentParticipants >= slot.maxParticipants ? 'text-red-600 dark:text-red-400' : ''}`}>
                    <Users size={12} />
                    {slot.currentParticipants}/{slot.maxParticipants}
                  </span>
                )}
              </div>

              <div className="flex gap-2 mt-2">
                {slot.entityType === 'task' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`flex-1 h-7 text-xs ${isDone ? 'text-green-600' : 'text-neutral-500'}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleTaskStatus(slot)
                    }}
                  >
                    {isDone ? 'Вернуть' : 'Выполнить'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={() => onEdit(slot)}
                >
                  Редактировать
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {selectedDate && (
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onAdd(selectedDate)}>
            Добавить
          </Button>
          <Button
            variant="ghost"
            className="text-orange-600 hover:bg-orange-50"
            onClick={() => onBlockDay(selectedDate)}
          >
            Выходной
          </Button>
        </div>
      )}
    </Card>
  )
}
