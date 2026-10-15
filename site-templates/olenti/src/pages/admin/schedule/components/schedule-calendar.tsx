import { Card } from '@components/atoms/Card'
import type { ScheduleSlot } from '@typings/admin'
import { Plus } from 'lucide-react'

interface ScheduleCalendarProps {
  currentDate: Date
  selectedDate: string | null
  slots: ScheduleSlot[]
  onSelectDate: (date: string) => void
  onChangeMonth: (direction: 'prev' | 'next') => void
  onAdd: (date: string) => void
}

const months = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function formatDateForInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getSlotsForDate(slots: ScheduleSlot[], dateStr: string): ScheduleSlot[] {
  return slots.filter(s => s.date === dateStr)
}

function isDayOffSlot(slot: ScheduleSlot): boolean {
  return (
    slot.entityType === 'task' &&
    (
      (slot.title || '').toLowerCase().includes('выходной') ||
      slot.maxParticipants === 0
    )
  )
}

export function ScheduleCalendar(props: ScheduleCalendarProps) {
  const { currentDate, selectedDate, slots, onSelectDate, onChangeMonth, onAdd } = props

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const startDay = (firstDayOfMonth.getDay() + 6) % 7
  const daysInMonth = lastDayOfMonth.getDate()

  const handlePrevMonth = () => onChangeMonth('prev')
  const handleNextMonth = () => onChangeMonth('next')

  const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-neutral-100">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-neutral-900 w-40">
            {months[month]} {year}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={handlePrevMonth}
              className="px-2 py-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600"
              aria-label="Предыдущий месяц"
            >
              ‹
            </button>
            <button
              onClick={handleNextMonth}
              className="px-2 py-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600"
              aria-label="Следующий месяц"
            >
              ›
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSelectDate(formatDateForInput(new Date()))}
            className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            Сегодня
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-neutral-100 bg-neutral-50">
        {weekDays.map(day => (
          <div key={day} className="py-2 text-center text-xs font-medium text-neutral-500 uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-[120px]">
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} className="border-b border-r border-neutral-100 bg-neutral-50/30" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = formatDate(new Date(year, month, day))
          const daySlots = getSlotsForDate(slots, dateStr)
          const hasDayOff = daySlots.some(isDayOffSlot)
          const isToday = dateStr === formatDateForInput(new Date())
          const isSelected = dateStr === selectedDate

          return (
            <div
              key={day}
              onClick={() => onSelectDate(dateStr)}
              className={`group relative p-2 border-b border-r border-neutral-100 cursor-pointer transition-all min-h-[120px] ${
                isSelected
                  ? 'bg-primary-50/40 ring-2 ring-inset ring-primary-500'
                  : hasDayOff
                    ? 'bg-orange-50/40'
                    : 'hover:bg-neutral-50'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className={`text-sm font-medium ${isToday ? 'text-primary-600 bg-primary-50 px-1.5 rounded-full' : 'text-neutral-700'}`}>
                  {day}
                </div>
                <div className="flex items-center gap-2">
                  {daySlots.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 border border-primary-200">
                        {daySlots.length}
                      </span>
                      {daySlots.some(s => s.currentParticipants >= s.maxParticipants) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200" title="Есть заполненные слоты">
                          ⚠
                        </span>
                      )}
                      {hasDayOff && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200"
                          title="День помечен как выходной"
                        >
                          Вых
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAdd(dateStr)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary-100 text-primary-600 rounded transition-all"
                    title="Добавить событие"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-1 overflow-y-auto max-h-[80px] no-scrollbar">
                {daySlots.map(slot => {
                  const isFull = slot.currentParticipants >= slot.maxParticipants
                  const occupancy = slot.maxParticipants > 0
                    ? `${slot.currentParticipants}/${slot.maxParticipants}`
                    : ''
                  const isDayOff = isDayOffSlot(slot)
                  return (
                    <div
                      key={slot.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded border truncate flex items-center justify-between gap-1 ${
                        isDayOff
                          ? 'bg-orange-50 border-orange-200 text-orange-700'
                          : slot.entityType === 'task'
                            ? 'bg-neutral-100 border-neutral-200 text-neutral-700'
                            : slot.entityType === 'consultation'
                              ? isFull
                                ? 'bg-purple-100 border-purple-300 text-purple-800'
                                : 'bg-purple-50 border-purple-100 text-purple-700'
                              : isFull
                                ? 'bg-blue-100 border-blue-300 text-blue-800'
                                : 'bg-blue-50 border-blue-100 text-blue-700'
                      }`}
                      title={`${slot.title || (slot.entityType === 'task' ? 'Задача' : 'Запись')}${occupancy ? ` (${occupancy})` : ''}`}
                    >
                      <span className="truncate">
                        {slot.startTime} {slot.title || (slot.entityType === 'task' ? 'Задача' : 'Запись')}
                      </span>
                      {occupancy && !isDayOff && (
                        <span className={`shrink-0 font-medium ${isFull ? 'text-red-600' : ''}`}>
                          {occupancy}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-neutral-100 bg-neutral-50/60 text-[11px] text-neutral-500">
        <span className="font-medium mr-1">Легенда:</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-neutral-200" />
          Задачи
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-purple-200" />
          Консультации
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-200" />
          Мастер-классы
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-200" />
          Выходной
        </span>
      </div>
    </Card>
  )
}
