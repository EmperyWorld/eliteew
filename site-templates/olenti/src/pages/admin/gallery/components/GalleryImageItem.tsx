import React from 'react'
import { Trash2, GripVertical, Image as ImageIcon } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { getUploadedImageUrl } from '@utils/imageUrl'

interface GalleryImageItemProps {
  image: {
    id: string
    url: string
    alt: string
    category: string
  }
  categories: Record<string, string>
  onDelete: (id: string) => void
  onUpdateAlt: (id: string, alt: string) => void
  onUpdateCategory: (id: string, category: string) => void
}

export const GalleryImageItem: React.FC<GalleryImageItemProps> = ({
  image,
  categories,
  onDelete,
  onUpdateAlt,
  onUpdateCategory
}) => {
  return (
    <Card className="overflow-hidden group">
      <div className="aspect-square bg-neutral-100 relative">
        {image.url ? (
          <img
            src={getUploadedImageUrl(image.url)}
            alt={image.alt}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={48} className="text-neutral-300" />
          </div>
        )}

        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => onDelete(image.id)}
            className="p-2 bg-white rounded-lg text-red-600 hover:bg-red-50"
            aria-label="Удалить"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Drag handle */}
        <div className="absolute top-2 left-2 p-1 bg-white/80 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-move">
          <GripVertical size={16} className="text-neutral-400" />
        </div>
      </div>

      <div className="p-3 space-y-2">
        <input
          type="text"
          value={image.alt}
          onChange={(e) => onUpdateAlt(image.id, e.target.value)}
          placeholder="Описание"
          className="w-full text-sm border-0 border-b border-neutral-200 bg-transparent px-0 py-1 focus:border-primary-500 focus:ring-0 focus:outline-none"
          aria-label="Описание изображения"
        />
        <select
          value={image.category}
          onChange={(e) => onUpdateCategory(image.id, e.target.value)}
          className="w-full text-xs border border-neutral-200 rounded-lg px-2 py-1 bg-white focus:border-primary-300 focus:outline-none"
          aria-label="Категория"
        >
          {Object.entries(categories).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
    </Card>
  )
}
