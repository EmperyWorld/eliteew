import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@components/atoms/Button'
import { Input } from '@components/atoms/Input'
import { Textarea } from '@components/atoms/Textarea'
import { Card } from '@components/atoms/Card'
import type { MasterclassCategory } from '@typings/admin'

interface MasterclassBasicInfoProps {
  isNew: boolean
  title: string
  slug: string
  category: MasterclassCategory
  level: string
  shortDescription: string
  description: string
  categoryLabels: Record<MasterclassCategory, string>
  levelLabels: Record<string, string>
  onBack: () => void
  onChange: (field: string, value: string) => void
  onGenerateSlug: () => void
}

export const MasterclassBasicInfo: React.FC<MasterclassBasicInfoProps> = ({
  isNew,
  title,
  slug,
  category,
  level,
  shortDescription,
  description,
  categoryLabels,
  levelLabels,
  onBack,
  onChange,
  onGenerateSlug
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 transition-colors"
          aria-label="Назад"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-display font-semibold text-neutral-900">
            {isNew ? 'Новый мастер-класс' : 'Редактирование мастер-класса'}
          </h1>
          <p className="text-neutral-500 mt-1">
            {isNew ? 'Создание нового мастер-класса' : title}
          </p>
        </div>
      </div>

      <Card className="p-6 space-y-6">
        <h2 className="text-lg font-semibold text-neutral-900">Основная информация</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Название *
            </label>
            <Input
              value={title}
              onChange={(e) => onChange('title', e.target.value)}
              placeholder="Например: Групповой воркшоп"
              required
              onBlur={() => !slug && onGenerateSlug()}
              aria-label="Название"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              URL (slug)
            </label>
            <div className="flex gap-2">
              <Input
                value={slug}
                onChange={(e) => onChange('slug', e.target.value)}
                placeholder="group-workshop"
                className="flex-1"
                aria-label="Slug"
              />
              <Button type="button" variant="outline" onClick={onGenerateSlug}>
                Сгенерировать
              </Button>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              /masterclasses/{slug || 'slug'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Категория *
              </label>
              <select
                value={category}
                onChange={(e) => onChange('category', e.target.value as MasterclassCategory)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 transition focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
                aria-label="Категория"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Уровень
              </label>
              <select
                value={level}
                onChange={(e) => onChange('level', e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 transition focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
                aria-label="Уровень"
              >
                {Object.entries(levelLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Краткое описание *
            </label>
            <Input
              value={shortDescription}
              onChange={(e) => onChange('shortDescription', e.target.value)}
              placeholder="Краткое описание для карточки"
              required
              aria-label="Краткое описание"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Полное описание *
            </label>
            <Textarea
              value={description}
              onChange={(e) => onChange('description', e.target.value)}
              placeholder="Подробное описание мастер-класса..."
              rows={6}
              required
              aria-label="Полное описание"
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
