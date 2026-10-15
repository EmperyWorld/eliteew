import React from 'react'
import { Plus, Trash2, Layers, GripVertical, DollarSign, Package, Percent } from 'lucide-react'
import { Button } from '@components/atoms/Button'
import { Input } from '@components/atoms/Input'
import type { ProductVariant } from '@typings/admin'

interface ProductVariantsProps {
  variants: ProductVariant[]
  onAdd: () => void
  onUpdate: (index: number, field: keyof ProductVariant, value: unknown) => void
  onRemove: (index: number) => void
}

export const ProductVariants: React.FC<ProductVariantsProps> = ({
  variants,
  onAdd,
  onUpdate,
  onRemove
}) => {
  // Calculate total stock
  const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0)
  const avgPrice = variants.length > 0
    ? Math.round(variants.reduce((sum, v) => sum + v.price, 0) / variants.length)
    : 0

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700 bg-neutral-50/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Layers size={18} className="text-purple-500" />
              Варианты товара
            </h2>
            <p className="text-sm text-neutral-500 dark:text-slate-400 mt-0.5">
              Разные объёмы и цены
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onAdd} className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
            <Plus size={16} className="mr-1.5" />
            Добавить вариант
          </Button>
        </div>

        {/* Stats */}
        {variants.length > 0 && (
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Layers size={14} className="text-purple-500" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">{variants.length} вариант{variants.length > 1 ? 'а' : ''}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <Package size={14} className="text-emerald-500" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{totalStock} шт. всего</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <DollarSign size={14} className="text-amber-500" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">~{avgPrice.toLocaleString('ru-RU')} ₽ средняя</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {variants.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-neutral-200 dark:border-slate-700 rounded-xl">
            <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center">
              <Layers size={28} className="text-neutral-400 dark:text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-1">Нет вариантов</h3>
            <p className="text-neutral-500 dark:text-slate-400 text-sm mb-4">
              Добавьте хотя бы один вариант с объёмом и ценой
            </p>
            <Button type="button" onClick={onAdd}>
              <Plus size={16} className="mr-1.5" />
              Добавить первый вариант
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {variants.map((variant, index) => (
              <div
                key={variant.id}
                className="group relative grid grid-cols-12 gap-3 items-center p-4 bg-neutral-50 dark:bg-slate-900/50 rounded-xl border border-transparent hover:border-primary-200 dark:hover:border-primary-800 transition-all"
              >
                {/* Drag handle */}
                <div className="col-span-1 flex justify-center">
                  <div className="p-1.5 text-neutral-300 dark:text-slate-600 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical size={16} />
                  </div>
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold rounded-lg group-hover:opacity-0 transition-opacity">
                    {index + 1}
                  </span>
                </div>

                {/* Volume */}
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1.5">
                    Объём
                  </label>
                  <Input
                    value={variant.volume}
                    onChange={(e) => onUpdate(index, 'volume', e.target.value)}
                    placeholder="5 мл"
                    aria-label={`Объём варианта ${index + 1}`}
                    className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                  />
                </div>

                {/* Price */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1.5">
                    Цена ₽
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={variant.price}
                      onChange={(e) => onUpdate(index, 'price', parseInt(e.target.value) || 0)}
                      min={0}
                      aria-label={`Цена варианта ${index + 1}`}
                      className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                    />
                  </div>
                </div>

                {/* Original Price */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    Старая <Percent size={10} className="text-red-400" />
                  </label>
                  <Input
                    type="number"
                    value={variant.originalPrice || ''}
                    onChange={(e) => onUpdate(index, 'originalPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                    min={0}
                    placeholder="—"
                    aria-label={`Старая цена варианта ${index + 1}`}
                    className="dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-600"
                  />
                </div>

                {/* Stock */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1.5">
                    Остаток
                  </label>
                  <Input
                    type="number"
                    value={variant.stock}
                    onChange={(e) => onUpdate(index, 'stock', parseInt(e.target.value) || 0)}
                    min={0}
                    aria-label={`Остаток варианта ${index + 1}`}
                    className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                  />
                </div>

                {/* Discount badge */}
                {variant.originalPrice && variant.originalPrice > variant.price && (
                  <div className="col-span-1 flex justify-center">
                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg">
                      -{Math.round((1 - variant.price / variant.originalPrice) * 100)}%
                    </span>
                  </div>
                )}

                {/* Delete button */}
                <div className={`${variant.originalPrice && variant.originalPrice > variant.price ? '' : 'col-span-2'} flex justify-end`}>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 text-neutral-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 transition-all"
                    aria-label="Удалить вариант"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
