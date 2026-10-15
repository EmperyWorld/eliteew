import { Button } from '@components/atoms/Button'
import type { ScheduleSlot } from '@typings/admin'
import { Bell, X } from 'lucide-react'
import { EntityOption, SlotFormData } from '../types'

interface ScheduleModalProps {
  isOpen: boolean
  formData: SlotFormData
  consultations: EntityOption[]
  masterclasses: EntityOption[]
  saving: boolean
  editingSlot: ScheduleSlot | null
  onChangeForm: (updater: (prev: SlotFormData) => SlotFormData) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ScheduleModal(props: ScheduleModalProps) {
  const {
    isOpen,
    formData,
    consultations,
    masterclasses,
    saving,
    editingSlot,
    onChangeForm,
    onSubmit,
    onClose,
  } = props

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-900">
            {editingSlot ? 'Редактировать' : 'Новое событие'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg" aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-100 rounded-xl">
            {(['task', 'masterclass', 'consultation'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => onChangeForm(prev => ({ ...prev, entityType: type }))}
                className={`py-2 text-sm font-medium rounded-lg transition-all ${
                  formData.entityType === type
                    ? 'bg-white shadow text-primary-600'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {type === 'task' ? 'Задача' : type === 'masterclass' ? 'МК' : 'Конс.'}
              </button>
            ))}
          </div>

          {formData.entityType === 'task' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="slot-title" className="block text-sm font-medium text-neutral-700 mb-1">Название задачи</label>
                <input
                  id="slot-title"
                  type="text"
                  value={formData.title}
                  onChange={e => onChangeForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Например: Подготовить контент"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="slot-description" className="block text-sm font-medium text-neutral-700 mb-1">Описание</label>
                <textarea
                  id="slot-description"
                  value={formData.description}
                  onChange={e => onChangeForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Детали задачи..."
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="slot-priority" className="block text-sm font-medium text-neutral-700 mb-1">Приоритет</label>
                  <select
                    id="slot-priority"
                    value={formData.priority}
                    onChange={e => onChangeForm(prev => ({ ...prev, priority: e.target.value as SlotFormData['priority'] }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="slot-status" className="block text-sm font-medium text-neutral-700 mb-1">Статус</label>
                  <select
                    id="slot-status"
                    value={formData.status}
                    onChange={e => onChangeForm(prev => ({ ...prev, status: e.target.value as SlotFormData['status'] }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="pending">В работе</option>
                    <option value="done">Готово</option>
                    <option value="cancelled">Отменено</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="slot-entity" className="block text-sm font-medium text-neutral-700 mb-1">Выберите услугу</label>
              <select
                id="slot-entity"
                value={formData.entityId}
                onChange={e => onChangeForm(prev => ({ ...prev, entityId: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                {(formData.entityType === 'consultation' ? consultations : masterclasses).map(e => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="slot-date" className="block text-sm font-medium text-neutral-700 mb-1">Дата</label>
            <input
              id="slot-date"
              type="date"
              value={formData.date}
              onChange={e => onChangeForm(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="slot-startTime" className="block text-sm font-medium text-neutral-700 mb-1">Начало</label>
              <input
                id="slot-startTime"
                type="time"
                value={formData.startTime}
                onChange={e => onChangeForm(prev => ({ ...prev, startTime: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label htmlFor="slot-endTime" className="block text-sm font-medium text-neutral-700 mb-1">Конец</label>
              <input
                id="slot-endTime"
                type="time"
                value={formData.endTime}
                onChange={e => onChangeForm(prev => ({ ...prev, endTime: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="slot-reminder" className="block text-sm font-medium text-neutral-700 mb-1">Напомнить за</label>
            <select
              id="slot-reminder"
              value={formData.remindBeforeMinutes}
              onChange={e => onChangeForm(prev => ({ ...prev, remindBeforeMinutes: parseInt(e.target.value, 10) || 0 }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value={0}>Не напоминать</option>
              <option value={15}>15 минут</option>
              <option value={30}>30 минут</option>
              <option value={60}>1 час</option>
            </select>
          </div>

          <div>
            <label htmlFor="slot-participants" className="block text-sm font-medium text-neutral-700 mb-1">Участники</label>
            <input
              id="slot-participants"
              type="number"
              min="1"
              value={formData.maxParticipants}
              onChange={e => onChangeForm(prev => ({ ...prev, maxParticipants: parseInt(e.target.value, 10) || 1 }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-neutral-200 bg-neutral-50 cursor-pointer hover:bg-neutral-100 transition-colors">
            <input
              type="checkbox"
              className="mt-1 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              checked={formData.notify}
              onChange={e => onChangeForm(prev => ({ ...prev, notify: e.target.checked }))}
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                <Bell size={14} className="text-primary-600" />
                Создать напоминание
              </p>
              <p className="text-xs text-neutral-500">Добавить внутреннее напоминание в очередь событий</p>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
