import { GalleryImagePickerModal } from '@pages/admin/components/GalleryImagePickerModal'
import { getUploadedImageUrl } from '@utils/imageUrl'
import { Image as ImageIcon, Images, Upload, X, ZoomIn } from 'lucide-react'
import React, { useRef, useState } from 'react'

interface ConsultationImageProps {
  image: string
  onChange: (value: string) => void
  onUpload: (file: File) => void
}

export const ConsultationImage: React.FC<ConsultationImageProps> = ({
  image,
  onChange,
  onUpload
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
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
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      onUpload(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file)
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700 bg-neutral-50/50 dark:bg-slate-900/50">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <ImageIcon size={18} className="text-purple-500" />
            Изображение
          </h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400 mt-0.5">
            Главное изображение консультации
          </p>
        </div>

        {/* Card Content */}
        <div className="p-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              isDragging
                ? 'border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                : 'border-neutral-200 dark:border-slate-700 bg-neutral-50/50 dark:bg-slate-900/30'
            }`}
          >
            {image ? (
              <div className="relative inline-block group">
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={getUploadedImageUrl(image)}
                    alt="Preview"
                    className="max-w-full h-auto max-h-96 rounded-xl shadow-lg group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setZoomImage(getUploadedImageUrl(image))}
                      className="p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-300 transition-colors"
                      aria-label="Увеличить изображение"
                    >
                      <ZoomIn size={20} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  <button
                    type="button"
                    onClick={() => setGalleryPickerOpen(true)}
                    className="px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors flex items-center gap-1.5"
                  >
                    <Images size={16} />
                    Из галереи
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-neutral-200 dark:border-slate-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    Заменить
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    aria-label="Удалить изображение"
                  >
                    <X size={16} className="inline mr-1" />
                    Удалить
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                  aria-label="Загрузить изображение"
                />
              </div>
            ) : (
              <div>
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-8 w-8 text-purple-500 dark:text-purple-400" />
                </div>
                <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">
                  Перетащите изображение,{' '}
                  <button
                    type="button"
                    onClick={() => setGalleryPickerOpen(true)}
                    className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium underline"
                  >
                    выберите из галереи
                  </button>
                  {' или '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium underline"
                  >
                    выберите файл
                  </button>
                </p>
                <p className="text-xs text-neutral-500 dark:text-slate-500 mt-1">
                  PNG, JPG до 5MB. Рекомендуемый размер: 1200×800px
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                  aria-label="Загрузить изображение"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <GalleryImagePickerModal
        open={galleryPickerOpen}
        onClose={() => setGalleryPickerOpen(false)}
        onSelect={(url) => onChange(url)}
        title="Выбрать изображение консультации из галереи"
      />

      {/* Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 dark:bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-7xl max-h-[90vh]">
            <img
              src={zoomImage}
              alt="Zoomed preview"
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
            />
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-300 transition-colors"
              aria-label="Закрыть"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
