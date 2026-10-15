import React from 'react'
import { Card } from '@components/atoms/Card'
import { Input } from '@components/atoms/Input'

interface MasterclassParamsProps {
  price: number
  priceNote: string
  duration: number
  minParticipants: number | undefined
  maxParticipants: number
  order: number
  onChange: (field: string, value: number | string | undefined) => void
}

export const MasterclassParams: React.FC<MasterclassParamsProps> = ({
  price,
  priceNote,
  duration,
  minParticipants,
  maxParticipants,
  order,
  onChange
}) => {
  return (
    <Card className="p-6 space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900">Параметры</h2>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Цена (₽) *
        </label>
        <Input
          type="number"
          value={price}
          onChange={(e) => onChange('price', parseInt(e.target.value) || 0)}
          min={0}
          step={100}
          required
          aria-label="Цена"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Примечание к цене
        </label>
        <Input
          value={priceNote}
          onChange={(e) => onChange('priceNote', e.target.value)}
          placeholder="с человека, от, и т.д."
          aria-label="Примечание к цене"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Длительность (мин) *
        </label>
        <Input
          type="number"
          value={duration}
          onChange={(e) => onChange('duration', parseInt(e.target.value) || 0)}
          min={15}
          step={15}
          required
          aria-label="Длительность"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Мин. участников
          </label>
          <Input
            type="number"
            value={minParticipants || ''}
            onChange={(e) => onChange('minParticipants', e.target.value ? parseInt(e.target.value) : undefined)}
            min={1}
            aria-label="Мин. участников"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Макс. участников *
          </label>
          <Input
            type="number"
            value={maxParticipants}
            onChange={(e) => onChange('maxParticipants', parseInt(e.target.value) || 1)}
            min={1}
            required
            aria-label="Макс. участников"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Порядок сортировки
        </label>
        <Input
          type="number"
          value={order}
          onChange={(e) => onChange('order', parseInt(e.target.value) || 0)}
          min={0}
          aria-label="Порядок сортировки"
        />
      </div>
    </Card>
  )
}
