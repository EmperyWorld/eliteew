import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { apiClient } from '@services/api/client'
import {
    useCreateGalleryImage,
    useDeleteGalleryImage,
    useGalleryImages,
    useUpdateGalleryImage
} from '@services/api/gallery'
import { Image as ImageIcon, Loader2, Plus, Upload } from 'lucide-react'
import React, { useState } from 'react'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { GalleryImageItem } from './components/GalleryImageItem'

const categories = {
  brand: 'Бренд / О бренде',
  consultations: 'Консультации',
  masterclasses: 'Мастер-классы',
  diplomas: 'Дипломы и сертификаты',
  products: 'Продукция',
  founder: 'Основатель / Портрет (legacy)',
  workshop: 'Мастер-классы (legacy)',
  certificates: 'Дипломы и сертификаты (legacy)',
}

export const GalleryPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof categories | 'all'>('all')
  const [isUploading, setIsUploading] = useState(false)

  const { data: images = [], isLoading } = useGalleryImages()
  const createMutation = useCreateGalleryImage()
  const updateMutation = useUpdateGalleryImage()
  const deleteMutation = useDeleteGalleryImage()

  const filteredImages = images.filter(
    (img) => selectedCategory === 'all' || img.category === selectedCategory
  )

  const handleUpload = async (files: FileList | null) => {
    if (!files) return
    setIsUploading(true)

    try {
      for (const file of Array.from(files)) {
        // Upload file first
        const formData = new FormData()
        formData.append('image', file)

        const { data: uploadResult } = await apiClient.post<{ url: string }>('/admin/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        // Create gallery image record
        await createMutation.mutateAsync({
          url: uploadResult.url,
          alt: file.name.replace(/\.[^/.]+$/, ''),
          category: selectedCategory === 'all' ? 'diplomas' : selectedCategory,
          order: images.length + 1,
        })
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const deleteImage = (id: string) => {
    if (window.confirm('Удалить изображение?')) {
      deleteMutation.mutate(id)
    }
  }

  const updateImageAlt = (id: string, alt: string) => {
    updateMutation.mutate({ id, alt })
  }

  const updateImageCategory = (id: string, category: string) => {
    updateMutation.mutate({ id, category })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Контент"
        title="Галерея"
        titleIcon={<ImageIcon className="text-primary-600 dark:text-primary-400" size={24} />}
        description="Управление изображениями сайта"
        actions={
        <label>
          <Button disabled={isUploading}>
            <Plus size={20} className="mr-2" />
            {isUploading ? 'Загрузка...' : 'Загрузить'}
          </Button>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </label>
        }
      />

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          Все ({images.length})
        </button>
        {Object.entries(categories).map(([key, label]) => {
          const count = images.filter((img) => img.category === key).length
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key as keyof typeof categories)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                selectedCategory === key
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {label} ({count})
            </button>
          )
        })}
      </div>

      {/* Upload area */}
      <Card className="p-8">
        <div
          className="border-2 border-dashed border-neutral-200 dark:border-slate-700 rounded-xl p-8 text-center hover:border-primary-300 dark:hover:border-primary-500 transition-colors"
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('border-primary-400', 'bg-primary-50', 'dark:border-primary-500', 'dark:bg-primary-900/20')
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('border-primary-400', 'bg-primary-50', 'dark:border-primary-500', 'dark:bg-primary-900/20')
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('border-primary-400', 'bg-primary-50', 'dark:border-primary-500', 'dark:bg-primary-900/20')
            handleUpload(e.dataTransfer.files)
          }}
        >
          <Upload className="mx-auto h-12 w-12 text-neutral-400 dark:text-slate-500" />
          <p className="mt-2 text-sm text-neutral-600 dark:text-slate-300">
            Перетащите изображения сюда или{' '}
            <label className="text-primary-600 hover:text-primary-700 cursor-pointer">
              выберите файлы
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
            </label>
          </p>
          <p className="text-xs text-neutral-500 dark:text-slate-500 mt-1">
            PNG, JPG до 5MB
          </p>
        </div>
      </Card>

      {/* Images grid */}
      {filteredImages.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredImages.map((image) => (
            <GalleryImageItem
              key={image.id}
              image={image}
              categories={categories}
              onDelete={deleteImage}
              onUpdateAlt={updateImageAlt}
              onUpdateCategory={updateImageCategory}
            />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <ImageIcon size={48} className="mx-auto text-neutral-300 dark:text-slate-600 mb-4" />
          <p className="text-neutral-500 dark:text-slate-400">
            {selectedCategory === 'all'
              ? 'Нет загруженных изображений'
              : `Нет изображений в категории "${categories[selectedCategory]}"`}
          </p>
        </Card>
      )}
    </div>
  )
}
