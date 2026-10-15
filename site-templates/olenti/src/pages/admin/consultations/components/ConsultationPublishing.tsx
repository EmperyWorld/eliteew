import React from 'react'
import { Save, X, Globe, Sparkles } from 'lucide-react'
import { Button } from '@components/atoms/Button'

interface ConsultationPublishingProps {
  status: string
  popular: boolean
  isSaving: boolean
  onChange: (field: string, value: string | boolean) => void
  onCancel: () => void
}

export const ConsultationPublishing: React.FC<ConsultationPublishingProps> = ({
  status,
  popular,
  isSaving,
  onChange,
  onCancel
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700 bg-neutral-50/50 dark:bg-slate-900/50">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Globe size={18} className="text-purple-500" />
          Публикация
        </h2>
        <p className="text-sm text-neutral-500 dark:text-slate-400 mt-0.5">
          Статус и видимость
        </p>
      </div>

      {/* Card Content */}
      <div className="p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
            Статус
          </label>
          <select
            value={status}
            onChange={(e) => onChange('status', e.target.value)}
            className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-sm text-neutral-900 dark:text-slate-100 transition focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800"
            aria-label="Статус публикации"
          >
            <option value="draft">Черновик</option>
            <option value="active">Активно</option>
            <option value="archived">В архиве</option>
          </select>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-slate-900/50 border border-neutral-200 dark:border-slate-700">
          <input
            type="checkbox"
            id="popular"
            checked={popular}
            onChange={(e) => onChange('popular', e.target.checked)}
            className="w-4 h-4 rounded border-neutral-300 dark:border-slate-600 text-purple-600 dark:text-purple-500 focus:ring-purple-500 dark:focus:ring-purple-400 bg-white dark:bg-slate-700"
            aria-label="Отметить как популярное"
          />
          <label htmlFor="popular" className="text-sm text-neutral-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer flex-1">
            <Sparkles size={14} className="text-amber-500" />
            Отметить как популярное
          </label>
        </div>

        <div className="pt-4 border-t border-neutral-200 dark:border-slate-700 space-y-3">
          <Button
            type="submit"
            fullWidth
            disabled={isSaving}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Save size={18} className="mr-2" />
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={onCancel}
            className="border-neutral-200 dark:border-slate-700 text-neutral-700 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-slate-700"
          >
            <X size={18} className="mr-2" />
            Отмена
          </Button>
        </div>
      </div>
    </div>
  )
}
