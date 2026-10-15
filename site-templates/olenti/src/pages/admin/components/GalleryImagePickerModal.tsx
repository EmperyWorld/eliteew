import { useGalleryImages } from '@services/api/gallery'
import { getUploadedImageUrl } from '@utils/imageUrl'
import { Image as ImageIcon, Loader2, X } from 'lucide-react'
import React, { useState } from 'react'

const CATEGORY_LABELS: Record<string, string> = {
  brand: 'Бренд / О бренде',
  consultations: 'Консультации',
  masterclasses: 'Мастер-классы',
  diplomas: 'Дипломы и сертификаты',
  products: 'Продукция',
  founder: 'Основатель / Портрет (legacy)',
  workshop: 'Мастер-классы (legacy)',
  certificates: 'Дипломы и сертификаты (legacy)',
}

interface GalleryImagePickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
  title?: string
}

export const GalleryImagePickerModal: React.FC<GalleryImagePickerModalProps> = ({
  open,
  onClose,
  onSelect,
  title = 'Выбрать из галереи'
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const { data: images = [], isLoading } = useGalleryImages()

  const filtered = categoryFilter === 'all'
    ? images
    : images.filter((img) => img.category === categoryFilter)

  if (!open) return null

  const handleSelect = (url: string) => {
    onSelect(url)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <ImageIcon size={20} className="text-primary-500" />
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-500 hover:text-neutral-700 dark:hover:text-slate-400 dark:hover:text-white transition-colors"
            aria-label="Закрыть"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 border-b border-neutral-100 dark:border-slate-700">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-neutral-200 dark:hover:bg-slate-600'
              }`}
            >
              Все ({images.length})
            </button>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
              const count = images.filter((img) => img.category === key).length
              if (count === 0) return null
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategoryFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    categoryFilter === key
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'bg-neutral-100 text-neutral-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-neutral-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-neutral-500 dark:text-slate-400 py-12">
              Нет изображений в галерее
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => handleSelect(img.url)}
                  className="aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-primary-500 dark:hover:border-primary-400 hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <img
                    src={getUploadedImageUrl(img.url)}
                    alt={img.alt || img.title || 'Фото'}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
