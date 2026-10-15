import { useGalleryImages } from '@services/api/gallery'
import { AnimatePresence, motion } from 'framer-motion'
import { Award, ChevronLeft, ChevronRight, X } from 'lucide-react'
import React, { useCallback, useState } from 'react'

export const DiplomasGallery: React.FC = () => {
  const { data: galleryImages = [], isLoading } = useGalleryImages()
  const diplomasData = React.useMemo(
    () =>
      galleryImages
        .filter((image) => image.category === 'diplomas' || image.category === 'certificates')
        .sort((a, b) => a.order - b.order),
    [galleryImages]
  )
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const openLightbox = (index: number) => setSelectedIndex(index)
  const closeLightbox = () => setSelectedIndex(null)

  const goToPrevious = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex(selectedIndex === 0 ? diplomasData.length - 1 : selectedIndex - 1)
    }
  }, [selectedIndex, diplomasData.length])

  const goToNext = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex(selectedIndex === diplomasData.length - 1 ? 0 : selectedIndex + 1)
    }
  }, [selectedIndex, diplomasData.length])

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') goToPrevious()
      if (e.key === 'ArrowRight') goToNext()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, goToPrevious, goToNext])

  if (isLoading) {
    return (
      <section className="py-12">
        <div className="text-neutral-500">Загрузка...</div>
      </section>
    )
  }

  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-8">
        <Award className="w-8 h-8 text-primary-600" />
        <h2 className="text-2xl sm:text-3xl font-display font-semibold text-neutral-900">
          Дипломы и сертификаты
        </h2>
      </div>

      {/* Gallery grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {diplomasData.length === 0 && (
          <div className="col-span-full text-sm text-neutral-500">Нет загруженных дипломов</div>
        )}
        {diplomasData.map((diploma, index) => (
          <motion.button
            key={diploma.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            onClick={() => openLightbox(index)}
            className="aspect-3/4 bg-neutral-100 rounded-xl overflow-hidden group relative focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {diploma.url ? (
              <img
                src={diploma.url}
                alt={diploma.alt || diploma.title || 'diploma'}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-neutral-400">
                <Award size={48} className="mb-2" />
                <span className="text-sm text-center">{diploma.title || 'Диплом'}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium">
                Открыть
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
              aria-label="Закрыть"
            >
              <X size={32} />
            </button>

            {/* Navigation */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
              className="absolute left-4 p-2 text-white/80 hover:text-white transition-colors"
              aria-label="Предыдущий"
            >
              <ChevronLeft size={40} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
              className="absolute right-4 p-2 text-white/80 hover:text-white transition-colors"
              aria-label="Следующий"
            >
              <ChevronRight size={40} />
            </button>

            {/* Image */}
            <motion.div
              key={selectedIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="max-w-4xl max-h-[80vh] relative"
              onClick={(e) => e.stopPropagation()}
            >
              {diplomasData[selectedIndex].url ? (
                <img
                  src={diplomasData[selectedIndex].url}
                  alt={diplomasData[selectedIndex].alt || diplomasData[selectedIndex].title || 'diploma'}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
              ) : (
                <div className="w-96 h-[500px] bg-neutral-800 rounded-lg flex flex-col items-center justify-center text-neutral-400">
                  <Award size={80} className="mb-4" />
                  <span className="text-lg">{diplomasData[selectedIndex].title}</span>
                  <span className="text-sm mt-2">Изображение скоро появится</span>
                </div>
              )}
              <p className="text-center text-white mt-4">
                {diplomasData[selectedIndex].title || 'Диплом'}
              </p>
              <p className="text-center text-white/60 text-sm">
                {selectedIndex + 1} / {diplomasData.length}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
