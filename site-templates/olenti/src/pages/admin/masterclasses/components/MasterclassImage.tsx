import { Card } from '@components/atoms/Card'
import { GalleryImagePickerModal } from '@pages/admin/components/GalleryImagePickerModal'
import { getUploadedImageUrl } from '@utils/imageUrl'
import { Images, Upload, X } from 'lucide-react'
import React, { useState } from 'react'

interface MasterclassImageProps {
  image: string
  onChange: (value: string) => void
  onUpload: (file: File) => void
}

export const MasterclassImage: React.FC<MasterclassImageProps> = ({
  image,
  onChange,
  onUpload
}) => {
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false)

  return (
    <Card className="p-6 space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Изображение</h2>

      <div className="border-2 border-dashed border-neutral-200 dark:border-slate-700 rounded-xl p-8 text-center">
        {image ? (
          <div className="relative inline-block">
            <img
              src={getUploadedImageUrl(image)}
              alt="Preview"
              className="max-w-xs rounded-lg"
            />
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              <button
                type="button"
                onClick={() => setGalleryPickerOpen(true)}
                className="px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 flex items-center gap-1.5"
              >
                <Images size={14} />
                Из галереи
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100"
                aria-label="Удалить изображение"
              >
                <X size={14} className="inline mr-1" />
                Удалить
              </button>
            </div>
          </div>
        ) : (
          <div>
            <Upload className="mx-auto h-12 w-12 text-neutral-400 dark:text-slate-500" />
            <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">
              <button
                type="button"
                onClick={() => setGalleryPickerOpen(true)}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium underline"
              >
                Выберите из галереи
              </button>
              {' или '}
              <label className="text-primary-600 hover:text-primary-700 cursor-pointer">
                выберите файл
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      onUpload(file)
                    }
                  }}
                  aria-label="Загрузить изображение"
                />
              </label>
            </p>
            <p className="text-xs text-neutral-500 dark:text-slate-500 mt-1">
              PNG, JPG до 5MB. Рекомендуемый размер: 1200×800px
            </p>
          </div>
        )}
      </div>

      <GalleryImagePickerModal
        open={galleryPickerOpen}
        onClose={() => setGalleryPickerOpen(false)}
        onSelect={(url) => onChange(url)}
        title="Выбрать изображение мастер-класса из галереи"
      />
    </Card>
  )
}
