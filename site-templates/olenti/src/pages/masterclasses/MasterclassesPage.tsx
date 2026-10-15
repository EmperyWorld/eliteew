import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Users, ArrowRight, GraduationCap, Loader2 } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { Button } from '@components/atoms/Button'
import { InnerPageSkeleton, PageLoadError } from '@components/storefront/StorefrontSkeletons'
import { usePageContent } from '@hooks/usePageContent'
import { defaultStorefrontImages, masterclassImages } from '@constants/siteImages'
import { useMasterclasses } from '@services/api/masterclasses'

const categoryLabels: Record<string, string> = {
  all: 'Все',
  workshop: 'Мастер-классы',
  tasting: 'Дегустации',
  education: 'Обучение',
  corporate: 'Корпоративные',
  special: 'Особые форматы',
}

export const MasterclassesPage: React.FC = () => {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const { data: masterclasses = [], isLoading } = useMasterclasses()
  const { contentStatus, getBlock, isContentReady, isContentError, reload } = usePageContent('masterclasses')

  const filteredMasterclasses = selectedCategory === 'all'
    ? masterclasses
    : masterclasses.filter((m) => m.category === selectedCategory)

  const getImage = (mc: { slug: string; image?: string | null }) => {
    if (mc.image) return mc.image
    return (
      masterclassImages[mc.slug as keyof typeof masterclassImages] ||
      defaultStorefrontImages.masterclass
    )
  }

  const formatPrice = (mc: { price: number; priceNote?: string | null }) => {
    if (mc.priceNote === 'от') {
      return `от ${mc.price.toLocaleString('ru-RU')} ₽`
    }
    if (mc.priceNote) {
      return `${mc.price.toLocaleString('ru-RU')} ₽ ${mc.priceNote}`
    }
    return `${mc.price.toLocaleString('ru-RU')} ₽`
  }

  if (contentStatus === 'loading' || !isContentReady) {
    return <InnerPageSkeleton />
  }
  if (isContentError) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-20">
        <PageLoadError label="Не удалось загрузить контент страницы мероприятий." onRetry={reload} />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
          <GraduationCap size={16} />
          События
        </span>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-neutral-900 mb-4">
          {getBlock('hero', 'title', 'Мастер-классы')}
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
          {getBlock('hero', 'description', 'Описание форматов и расписания — в контент-блоках админки.')}
        </p>
      </motion.div>

      {/* Category filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-wrap justify-center gap-2 mb-8"
      >
        {Object.entries(categoryLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === key
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {label}
          </button>
        ))}
      </motion.div>

      {/* Masterclasses grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMasterclasses.map((masterclass, index) => (
          <motion.div
            key={masterclass.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.05 }}
          >
            <Card
              className="p-0 h-full flex flex-col hover:shadow-lg transition-shadow duration-300 cursor-pointer overflow-hidden group"
              onClick={() => navigate(`/masterclasses/${masterclass.slug}`)}
            >
              {/* Image */}
              <div className="relative h-44 overflow-hidden">
                <img
                  src={getImage(masterclass)}
                  alt={masterclass.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute top-3 left-3 inline-block px-2 py-1 bg-white/90 backdrop-blur-sm text-blue-700 text-xs font-medium rounded-full shadow-sm">
                  {categoryLabels[masterclass.category]}
                </span>
              </div>

              <div className="p-5 flex flex-col flex-1">
                <h2 className="text-lg font-semibold text-neutral-900 mb-2">{masterclass.title}</h2>
                <p className="text-neutral-600 text-sm flex-1 mb-4">{masterclass.shortDescription}</p>

                <div className="space-y-3 pt-4 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-neutral-500">
                      <Clock size={16} />
                      {Math.floor(masterclass.duration / 60)} ч {masterclass.duration % 60 > 0 ? `${masterclass.duration % 60} мин` : ''}
                    </span>
                    <span className="flex items-center gap-2 text-sm text-neutral-500">
                      <Users size={16} />
                      до {masterclass.maxParticipants} чел.
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-display text-primary-700">
                      {formatPrice(masterclass)}
                    </span>
                    <Button variant="ghost" size="sm" className="group">
                      Подробнее
                      <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      )}

      {/* CTA section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-12"
      >
        <Card className="p-8 text-center bg-gradient-to-br from-blue-50 to-primary-50">
          <h3 className="text-2xl font-display text-neutral-900 mb-4">
            Хотите организовать мероприятие?
          </h3>
          <p className="text-neutral-600 mb-6 max-w-xl mx-auto">
            Свяжитесь со мной для обсуждения индивидуального формата мастер-класса
          </p>
          <Button onClick={() => navigate('/contacts')}>
            Обсудить детали
          </Button>
        </Card>
      </motion.div>
    </div>
  )
}
