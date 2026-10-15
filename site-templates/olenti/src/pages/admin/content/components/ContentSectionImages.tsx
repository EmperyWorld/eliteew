import React, { useState, useRef } from 'react'
import { Image, Upload, X, ZoomIn, Loader2 } from 'lucide-react'
import { Button } from '@components/atoms/Button'
import { getUploadedImageUrl } from '@utils/imageUrl'

interface ImageDef {
  key: string
  name: string
  hint?: string
}

interface ContentSectionImagesProps {
  pageId: string
  section: {
    id: string
    blocks: unknown[]
    images: ImageDef[]
  }
  uploading: string | null
  getImageUrl: (page: string, section: string, key: string) => string
  onImageUpload: (page: string, section: string, key: string, file: File) => void
  onImageDelete: (page: string, section: string, key: string) => void
}

export const ContentSectionImages: React.FC<ContentSectionImagesProps> = ({
  pageId,
  section,
  uploading,
  getImageUrl,
  onImageUpload,
  onImageDelete
}) => {
  const [dragging, setDragging] = useState<string | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  if (section.images.length === 0) return null

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault()
    setDragging(key)
  }

  const handleDragLeave = () => {
    setDragging(null)
  }

  const handleDrop = (e: React.DragEvent, key: string) => {
    e.preventDefault()
    setDragging(null)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      onImageUpload(pageId, section.id, key, file)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <h4 className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-slate-700">
          <Image size={14} className="text-purple-500" />
          Изображения
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {section.images.map(imageDef => {
            const imageUrl = getImageUrl(pageId, section.id, imageDef.key)
            const uploadKey = `${pageId}-${section.id}-${imageDef.key}`
            const isUploading = uploading === uploadKey
            const isDraggingOver = dragging === imageDef.key

            return (
              <div
                key={imageDef.key}
                className="p-4 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                    {imageDef.name}
                    <span className="text-xs text-neutral-400 dark:text-slate-500 bg-neutral-100 dark:bg-slate-700 px-2 py-0.5 rounded font-mono">
                      {imageDef.key}
                    </span>
                  </label>
                </div>
                {imageDef.hint && (
                  <p className="text-xs text-neutral-500 dark:text-slate-400 mb-3 italic">
                    {imageDef.hint}
                  </p>
                )}
                <div
                  onDragOver={(e) => handleDragOver(e, imageDef.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, imageDef.key)}
                  className={`relative aspect-video bg-neutral-100 dark:bg-slate-700 rounded-xl overflow-hidden border-2 transition-all ${
                    isDraggingOver
                      ? 'border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-neutral-200 dark:border-slate-600'
                  } group`}
                >
                  {imageUrl ? (
                    <>
                      <img
                        src={getUploadedImageUrl(imageUrl)}
                        alt={imageDef.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setZoomImage(getUploadedImageUrl(imageUrl))}
                          className="p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-300 transition-colors"
                          aria-label="Увеличить изображение"
                        >
                          <ZoomIn size={20} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-300 dark:text-slate-500">
                      <Image size={40} className="mb-2" />
                      <span className="text-xs">Перетащите изображение</span>
                    </div>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/70 dark:bg-black/80 flex items-center justify-center backdrop-blur-sm">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-2" />
                        <span className="text-white text-sm">Загрузка...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <label className="flex-1">
                    <input
                      ref={(el) => { fileInputRefs.current[imageDef.key] = el }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          onImageUpload(pageId, section.id, imageDef.key, file)
                        }
                      }}
                      aria-label={`Загрузить изображение для ${imageDef.name}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-neutral-200 dark:border-slate-600 text-neutral-700 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-slate-700"
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[imageDef.key]?.click()}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={14} className="mr-1 animate-spin" />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Upload size={14} className="mr-1" />
                          {imageUrl ? 'Заменить' : 'Загрузить'}
                        </>
                      )}
                    </Button>
                  </label>
                  {imageUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => {
                        onImageDelete(pageId, section.id, imageDef.key)
                      }}
                      aria-label="Удалить изображение"
                    >
                      <X size={14} />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

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
