import { productCollectionChipClass } from '@constants/productCollections'
import React from 'react'
import { Link } from 'react-router-dom'
import { Edit, Package, Trash2, Save, X, ExternalLink } from 'lucide-react'
import { getProductImage } from '@utils/productImages'
import { Checkbox } from '@components/atoms/Checkbox'
import type { Product } from '@typings/product'

interface ProductListItemProps {
  product: Product
  collectionLabels: Record<string, string>
  editingId: string | null
  editForm: { price: number; inStock: boolean }
  onStartEdit: (product: Product) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string) => void
  onEditFormChange: (form: { price: number; inStock: boolean }) => void
  onDelete: (id: string, name: string) => void
  selected?: boolean
  onSelect?: () => void
}

export const ProductListItem: React.FC<ProductListItemProps> = ({
  product,
  collectionLabels,
  editingId,
  editForm,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditFormChange,
  onDelete,
  selected,
  onSelect
}) => {
  const isEditing = editingId === product.id
  const collectionColor = productCollectionChipClass(product.collection || '') || 'bg-neutral-100 text-neutral-700 dark:bg-slate-700 dark:text-slate-300'

  return (
    <tr className={`
      transition-colors group
      ${selected
        ? 'bg-primary-50/50 dark:bg-primary-900/20'
        : 'hover:bg-neutral-50 dark:hover:bg-slate-700/50'
      }
    `}>
      <td className="pl-4 py-3 w-10">
        {onSelect && (
          <Checkbox
            checked={selected}
            onChange={onSelect}
            aria-label={`Выбрать ${product.name}`}
          />
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-slate-700 overflow-hidden shrink-0 ring-2 ring-transparent group-hover:ring-primary-200 dark:group-hover:ring-primary-800 transition-all">
            {product.image ? (
              <img
                src={getProductImage(product.image, product.name)}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={18} className="text-neutral-300 dark:text-slate-500" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <Link
              to={`/admin/products/${product.id}`}
              className="font-medium text-neutral-900 dark:text-white truncate hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {product.name}
            </Link>
            {product.stockQuantity !== undefined && (
              <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                Остаток: {product.stockQuantity} шт.
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${collectionColor}`}>
          {collectionLabels[product.collection || ''] || product.collection || '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-neutral-600 dark:text-slate-400">
        {product.variants && product.variants.length > 0
          ? product.variants.map(v => v.volume).join(', ')
          : product.volume || '—'}
      </td>
      <td className="px-4 py-3 text-right">
        {isEditing ? (
          <input
            type="number"
            value={editForm.price}
            onChange={(e) => onEditFormChange({ ...editForm, price: Number(e.target.value) })}
            className="w-24 px-2 py-1 text-right border border-primary-300 dark:border-primary-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 focus:outline-none"
            aria-label="Цена"
          />
        ) : (
          <span className="font-semibold text-neutral-900 dark:text-white">
            {product.variants && product.variants.length > 0
              ? `${Math.min(...product.variants.map(v => v.price)).toLocaleString('ru-RU')}—${Math.max(...product.variants.map(v => v.price)).toLocaleString('ru-RU')}₽`
              : `${product.price.toLocaleString('ru-RU')}₽`}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right hidden md:table-cell">
        {isEditing ? (
          <button
            onClick={() => onEditFormChange({ ...editForm, inStock: !editForm.inStock })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              editForm.inStock
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60'
                : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60'
            }`}
          >
            {editForm.inStock ? '✓ В наличии' : '✕ Нет в наличии'}
          </button>
        ) : (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
            product.inStock
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {product.inStock ? '✓ В наличии' : '✕ Нет'}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {isEditing ? (
            <>
              <button
                onClick={() => onSaveEdit(product.id)}
                className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                title="Сохранить"
                aria-label="Сохранить изменения"
              >
                <Save size={16} />
              </button>
              <button
                onClick={onCancelEdit}
                className="p-2 text-neutral-500 dark:text-slate-400 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Отмена"
                aria-label="Отменить изменения"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onStartEdit(product)}
                className="p-2 text-neutral-500 dark:text-slate-400 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Быстрое редактирование"
                aria-label="Быстрое редактирование"
              >
                <Edit size={16} />
              </button>
              <Link
                to={`/admin/products/${product.id}`}
                className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                title="Открыть"
                aria-label="Подробное редактирование"
              >
                <ExternalLink size={16} />
              </Link>
              <button
                onClick={() => onDelete(product.id, product.name)}
                className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Удалить"
                aria-label="Удалить товар"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
