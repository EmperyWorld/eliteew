import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Star, ArrowRight, Sparkles, Loader2 } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { Button } from '@components/atoms/Button'
import { InnerPageSkeleton, PageLoadError } from '@components/storefront/StorefrontSkeletons'
import { consultationImages, defaultStorefrontImages } from '@constants/siteImages'
import { usePageContent } from '@hooks/usePageContent'
import { useConsultations } from '@services/api/consultations'

export const ConsultationsPage: React.FC = () => {
  const navigate = useNavigate()
  const { data: consultations = [], isLoading } = useConsultations()
  const { contentStatus, getBlock, isContentReady, isContentError, reload } = usePageContent('consultations')

  const getImage = (consultation: { slug: string; image?: string | null }) => {
    // Если есть загруженная картинка - используем её
    if (consultation.image) {
      return consultation.image
    }
    // Иначе fallback на статические картинки по slug
    return (
      consultationImages[consultation.slug as keyof typeof consultationImages] ||
      defaultStorefrontImages.consultation
    )
  }

  if (contentStatus === 'loading' || !isContentReady) {
    return <InnerPageSkeleton />
  }
  if (isContentError) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-20">
        <PageLoadError label="Не удалось загрузить контент страницы консультаций." onRetry={reload} />
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
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-4">
          <Sparkles size={16} />
          Услуги
        </span>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-neutral-900 mb-4">
          {getBlock('hero', 'title', 'Консультации')}
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
          {getBlock('hero', 'description', 'Описание раздела и форматов записи — в контент-блоках админки.')}
        </p>
      </motion.div>

      {/* Consultations grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {consultations.map((consultation, index) => (
          <motion.div
            key={consultation.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card
              className="p-0 h-full flex flex-col hover:shadow-lg transition-shadow duration-300 cursor-pointer overflow-hidden"
              onClick={() => navigate(`/consultations/${consultation.slug}`)}
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden">
                <img
                  src={getImage(consultation)}
                  alt={consultation.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {consultation.isPopular && (
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full shadow-sm">
                    <Star size={12} />
                    Популярное
                  </span>
                )}
              </div>

              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-semibold text-neutral-900">{consultation.title}</h2>
                  <span className="text-2xl font-display text-primary-700">
                    {consultation.price.toLocaleString('ru-RU')} ₽
                  </span>
                </div>

                <p className="text-neutral-600 flex-1 mb-4">{consultation.shortDescription}</p>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                  <span className="flex items-center gap-2 text-sm text-neutral-500">
                    <Clock size={16} />
                    {consultation.duration} минут
                  </span>
                  <Button variant="ghost" size="sm" className="group">
                    Подробнее
                    <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </Button>
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
        <Card className="p-8 text-center bg-gradient-to-br from-primary-50 to-accent-50">
          <h3 className="text-2xl font-display text-neutral-900 mb-4">
            Не знаете, какую консультацию выбрать?
          </h3>
          <p className="text-neutral-600 mb-6 max-w-xl mx-auto">
            Напишите мне, и я помогу подобрать формат, который подойдёт именно вам
          </p>
          <Button onClick={() => navigate('/contacts')}>
            Связаться
          </Button>
        </Card>
      </motion.div>
    </div>
  )
}
