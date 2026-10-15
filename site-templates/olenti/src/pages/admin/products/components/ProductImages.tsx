import { GalleryImagePickerModal } from '@pages/admin/components/GalleryImagePickerModal'
import { GripVertical, Image as ImageIcon, Images, Star, Trash2, Upload, X, ZoomIn } from 'lucide-react'
import React, { useRef, useState } from 'react'

interface ProductImagesProps {
  images: string[]
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: (index: number) => void
  onAddFromGallery?: (url: string) => void
}

export const ProductImages: React.FC<ProductImagesProps> = ({
  images,
  onUpload,
  onRemove,
  onAddFromGallery
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    // Handle dropped files - convert to change event format
    const files = e.dataTransfer.files
    if (files.length > 0 && fileInputRef.current) {
      const dataTransfer = new DataTransfer()
      Array.from(files).forEach(file => dataTransfer.items.add(file))
      fileInputRef.current.files = dataTransfer.files
      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700 bg-neutral-50/50 dark:bg-slate-900/50">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <ImageIcon size={18} className="text-blue-500" />
            Изображения
          </h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400 mt-0.5">
            Загрузите фотографии товара
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Upload area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-2xl p-8 text-center transition-all
              ${isDragging
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-[1.02]'
                : 'border-neutral-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-neutral-50 dark:hover:bg-slate-900/50'
              }
            `}
          >
            <div className={`
              w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all
              ${isDragging
                ? 'bg-primary-100 dark:bg-primary-900/40'
                : 'bg-neutral-100 dark:bg-slate-700'
              }
            `}>
              <Upload className={`h-8 w-8 transition-colors ${isDragging ? 'text-primary-500' : 'text-neutral-400 dark:text-slate-500'}`} />
            </div>
            <p className="text-sm text-neutral-600 dark:text-slate-400">
              {onAddFromGallery && (
                <>
                  <button
                    type="button"
                    onClick={() => setGalleryPickerOpen(true)}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium underline inline-flex items-center gap-1.5 mr-1"
                  >
                    <Images size={16} className="inline" />
                    Выбрать из галереи
                  </button>
                  {' · '}
                </>
              )}
              Перетащите изображения сюда или{' '}
              <label className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer font-medium">
                выберите файлы
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onUpload}
                />
              </label>
            </p>
            <p className="text-xs text-neutral-400 dark:text-slate-500 mt-2">
              PNG, JPG, WebP до 5MB. Рекомендуемый размер: 800×800px
            </p>
          </div>

          {/* Images grid */}
          {images.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-medium text-neutral-700 dark:text-slate-300">
                  Загружено: {images.length} изображени{images.length === 1 ? 'е' : images.length < 5 ? 'я' : 'й'}
                </p>
                <div className="flex items-center gap-2">
                  {onAddFromGallery && (
                    <button
                      type="button"
                      onClick={() => setGalleryPickerOpen(true)}
                      className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800"
                    >
                      <Images size={14} />
                      Добавить из галереи
                    </button>
                  )}
                  <p className="text-xs text-neutral-400 dark:text-slate-500">
                    Первое изображение — главное
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div
                    key={index}
                    className={`
                      group relative aspect-square rounded-xl overflow-hidden
                      ${index === 0
                        ? 'ring-2 ring-primary-500 dark:ring-primary-400 ring-offset-2 dark:ring-offset-slate-800'
                        : 'border border-neutral-200 dark:border-slate-700'
                      }
                    `}
                  >
                    <img
                      src={image}
                      alt={`Product ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setPreviewImage(image)}
                        className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg text-neutral-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all hover:scale-110"
                        aria-label="Просмотреть"
                      >
                        <ZoomIn size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(index)}
                        className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg text-red-500 hover:bg-white dark:hover:bg-slate-700 transition-all hover:scale-110"
                        aria-label="Удалить изображение"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {/* Main badge */}
                    {index === 0 && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-primary-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-lg">
                        <Star size={12} fill="currentColor" /> Главное
                      </div>
                    )}

                    {/* Index badge */}
                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-black/60 backdrop-blur-sm text-white text-xs font-bold rounded-lg flex items-center justify-center">
                      {index + 1}
                    </div>

                    {/* Drag handle */}
                    <div className="absolute top-2 right-2 p-1 bg-white/80 dark:bg-slate-800/80 rounded-lg text-neutral-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity">
                      <GripVertical size={14} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <GalleryImagePickerModal
        open={galleryPickerOpen}
        onClose={() => setGalleryPickerOpen(false)}
        onSelect={(url) => onAddFromGallery?.(url)}
        title="Выбрать изображение товара из галереи"
      />

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 p-2 bg-white dark:bg-slate-800 rounded-full text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white shadow-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
