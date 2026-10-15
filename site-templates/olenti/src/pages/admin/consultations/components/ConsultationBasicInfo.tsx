import React from 'react'
import { ArrowLeft, MessageSquare, Sparkles, Link as LinkIcon, Type, FileText } from 'lucide-react'
import { Button } from '@components/atoms/Button'
import { Input } from '@components/atoms/Input'
import { Textarea } from '@components/atoms/Textarea'

interface ConsultationBasicInfoProps {
  isNew: boolean
  title: string
  slug: string
  shortDescription: string
  description: string
  onBack: () => void
  onChange: (field: string, value: string) => void
  onGenerateSlug: () => void
}

export const ConsultationBasicInfo: React.FC<ConsultationBasicInfoProps> = ({
  isNew,
  title,
  slug,
  shortDescription,
  description,
  onBack,
  onChange,
  onGenerateSlug
}) => {

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-700 text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-white transition-all shadow-sm"
          aria-label="Назад"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
              <MessageSquare size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                {isNew ? 'Новая консультация' : 'Редактирование'}
                {isNew && <Sparkles size={18} className="text-amber-500" />}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                {isNew ? 'Создание нового типа консультации' : title || 'Без названия'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700 bg-neutral-50/50 dark:bg-slate-900/50">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <FileText size={18} className="text-purple-500" />
            Основная информация
          </h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400 mt-0.5">
            Базовые данные о консультации
          </p>
        </div>

        {/* Card Content */}
        <div className="p-6 space-y-5">

          {/* Title field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300">
              <Type size={14} className="text-neutral-400 dark:text-slate-500" />
              Название консультации <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => onChange('title', e.target.value)}
              placeholder="Например: Аромаколода"
              required
              onBlur={() => !slug && onGenerateSlug()}
              className="bg-white dark:bg-slate-700 border-neutral-200 dark:border-slate-600 text-neutral-900 dark:text-slate-100"
              aria-label="Название"
            />
          </div>

          {/* Slug field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300">
              <LinkIcon size={14} className="text-neutral-400 dark:text-slate-500" />
              URL (slug)
            </label>
            <div className="flex gap-2">
              <Input
                value={slug}
                onChange={(e) => onChange('slug', e.target.value)}
                placeholder="intro-session"
                className="flex-1 bg-white dark:bg-slate-700 border-neutral-200 dark:border-slate-600 text-neutral-900 dark:text-slate-100"
                aria-label="Slug"
              />
              <Button type="button" variant="outline" onClick={onGenerateSlug} className="shrink-0">
                Сгенерировать
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-slate-400 bg-neutral-50 dark:bg-slate-900/50 px-3 py-2 rounded-lg border border-neutral-200 dark:border-slate-700">
              <LinkIcon size={12} />
              <span>/consultations/{slug || 'slug'}</span>
            </div>
          </div>

          {/* Short Description field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300">
              <FileText size={14} className="text-neutral-400 dark:text-slate-500" />
              Краткое описание <span className="text-red-500">*</span>
            </label>
            <Input
              value={shortDescription}
              onChange={(e) => onChange('shortDescription', e.target.value)}
              placeholder="Краткое описание для карточки"
              required
              className="bg-white dark:bg-slate-700 border-neutral-200 dark:border-slate-600 text-neutral-900 dark:text-slate-100"
              aria-label="Краткое описание"
            />
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Отображается в карточке консультации
            </p>
          </div>

          {/* Full Description field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300">
                <FileText size={14} className="text-neutral-400 dark:text-slate-500" />
                Полное описание <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-neutral-500 dark:text-slate-400">
                {description.length} символов
              </span>
            </div>
            <Textarea
              value={description}
              onChange={(e) => onChange('description', e.target.value)}
              placeholder="Подробное описание консультации..."
              rows={8}
              required
              className="bg-white dark:bg-slate-700 border-neutral-200 dark:border-slate-600 text-neutral-900 dark:text-slate-100 placeholder:text-neutral-400 dark:placeholder:text-slate-500"
              aria-label="Полное описание"
            />
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Подробная информация о консультации
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
