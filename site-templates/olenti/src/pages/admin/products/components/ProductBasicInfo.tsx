import React from 'react'
import { ArrowLeft, Package, Sparkles, Link as LinkIcon, Type, FileText, Tag, FolderOpen } from 'lucide-react'
import { Button } from '@components/atoms/Button'
import { Input } from '@components/atoms/Input'
import { Textarea } from '@components/atoms/Textarea'
import { PRODUCT_COLLECTION_COLORS } from '@constants/productCollections'

interface ProductBasicInfoProps {
  isNew: boolean
  name: string
  slug: string
  collection: string
  category: string
  description: string
  collectionLabels: Record<string, string>
  categoryLabels: Record<string, string>
  onBack: () => void
  onChange: (field: string, value: unknown) => void
  onGenerateSlug: () => void
}

export const ProductBasicInfo: React.FC<ProductBasicInfoProps> = ({
  isNew,
  name,
  slug,
  collection,
  category,
  description,
  collectionLabels,
  categoryLabels,
  onBack,
  onChange,
  onGenerateSlug
}) => {
  const gradientColor = PRODUCT_COLLECTION_COLORS[collection] || 'from-primary-500 to-primary-600'

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
            <div className={`p-2 bg-gradient-to-br ${gradientColor} rounded-xl shadow-lg`}>
              <Package size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                {isNew ? 'Новый товар' : 'Редактирование'}
                {isNew && <Sparkles size={18} className="text-amber-500" />}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                {isNew ? 'Создание нового товара в каталоге' : name || 'Без названия'}
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
            <FileText size={18} className="text-primary-500" />
            Основная информация
          </h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400 mt-0.5">
            Базовые данные о товаре
          </p>
        </div>

        {/* Card Content */}
        <div className="p-6 space-y-5">
          {/* Name field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300">
              <Type size={14} className="text-neutral-400 dark:text-slate-500" />
              Название товара <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="Например: Амурский бархат"
              required
              onBlur={() => !slug && onGenerateSlug()}
              aria-label="Название товара"
              className="dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-slate-500"
            />
          </div>

          {/* Slug field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300">
              <LinkIcon size={14} className="text-neutral-400 dark:text-slate-500" />
              URL (slug)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500 text-sm">
                  /catalog/
                </span>
                <Input
                  value={slug}
                  onChange={(e) => onChange('slug', e.target.value)}
                  placeholder="amurskij-barhat"
                  className="pl-16 dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-slate-500"
                  aria-label="URL товара"
                />
              </div>
              <Button type="button" variant="outline" onClick={onGenerateSlug} className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                Сгенерировать
              </Button>
            </div>
          </div>

          {/* Collection & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300">
                <FolderOpen size={14} className="text-neutral-400 dark:text-slate-500" />
                Коллекция <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={collection}
                  onChange={(e) => onChange('collection', e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-neutral-700 dark:text-slate-300 transition focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900 appearance-none"
                  aria-label="Коллекция"
                >
                  {Object.entries(collectionLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gradient-to-br ${gradientColor}`} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300">
                <Tag size={14} className="text-neutral-400 dark:text-slate-500" />
                Категория <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => onChange('category', e.target.value)}
                className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-neutral-700 dark:text-slate-300 transition focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                aria-label="Категория"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300">
              <FileText size={14} className="text-neutral-400 dark:text-slate-500" />
              Описание <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => onChange('description', e.target.value)}
              placeholder="Расскажите о товаре, его особенностях и преимуществах..."
              rows={5}
              required
              aria-label="Описание товара"
              className="dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-slate-500 resize-none"
            />
            <p className="text-xs text-neutral-400 dark:text-slate-500">
              {description.length}/1000 символов
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
