import React from 'react'
import { Save } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { Button } from '@components/atoms/Button'

interface MasterclassPublishingProps {
  status: string
  isSaving: boolean
  onChange: (value: string) => void
  onCancel: () => void
}

export const MasterclassPublishing: React.FC<MasterclassPublishingProps> = ({
  status,
  isSaving,
  onChange,
  onCancel
}) => {
  return (
    <Card className="p-6 space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900">Публикация</h2>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Статус
        </label>
        <select
          value={status}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 transition focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
          aria-label="Статус"
        >
          <option value="draft">Черновик</option>
          <option value="active">Активно</option>
          <option value="archived">В архиве</option>
        </select>
      </div>

      <div className="pt-4 border-t border-neutral-200 space-y-3">
        <Button type="submit" fullWidth disabled={isSaving}>
          <Save size={18} className="mr-2" />
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </Button>
        <Button
          type="button"
          variant="outline"
          fullWidth
          onClick={onCancel}
        >
          Отмена
        </Button>
      </div>
    </Card>
  )
}
