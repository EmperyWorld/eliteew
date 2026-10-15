import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { Input } from '@components/atoms/Input'
import { consultationImages, defaultStorefrontImages } from '@constants/siteImages'
import { apiClient } from '@services/api/client'
import { useConsultation } from '@services/api/consultations'
import { useUserStore } from '@store/slices/userSlice'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, Clock, Loader2, Send, Star } from 'lucide-react'
import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export const ConsultationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useUserStore()

  const { data: consultation, isLoading } = useConsultation(id || '')

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    message: '',
    preferredDate: '',
  })

  // Autofill form with user data
  React.useEffect(() => {
    if (isAuthenticated && user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        phone: user.phone || prev.phone,
      }))
    }
  }, [isAuthenticated, user])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!consultation) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-display mb-4">Консультация не найдена</h1>
        <Button onClick={() => navigate('/consultations')}>Все консультации</Button>
      </div>
    )
  }

  const description = consultation.fullDescription || consultation.shortDescription

  const getImage = () => {
    if (consultation.image) return consultation.image
    return (
      consultationImages[consultation.slug as keyof typeof consultationImages] ||
      defaultStorefrontImages.consultation
    )
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const guestName = formData.name.trim() || user?.name
      if (!guestName) {
        alert('Пожалуйста, укажите, как к вам обращаться.')
        setIsSubmitting(false)
        return
      }

      await apiClient.post('/bookings', {
        consultationId: consultation.id,
        guestName,
        guestPhone: isAuthenticated ? undefined : formData.phone,
        date: formData.preferredDate,
        time: '10:00',
        notes: formData.message || undefined,
      })
      setIsSubmitted(true)
    } catch (error) {
      console.error('Booking error:', error)
      alert('Ошибка при записи. Попробуйте позже.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <Button
        variant="ghost"
        onClick={() => navigate('/consultations')}
        className="mb-6 inline-flex items-center gap-2"
      >
        <ArrowLeft size={18} />
        Все консультации
      </Button>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr_380px]">
        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Hero image */}
          <div className="rounded-2xl overflow-hidden mb-6 aspect-video">
            <img
              src={getImage()}
              alt={consultation.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="mb-6">
            {consultation.isPopular && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded-full mb-4">
                <Star size={14} />
                Популярное
              </span>
            )}
            <h1 className="text-3xl sm:text-4xl font-display text-neutral-900 mb-4">
              {consultation.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-neutral-600">
              <span className="flex items-center gap-2">
                <Clock size={18} />
                {consultation.duration} минут
              </span>
              <span className="text-2xl font-display text-primary-700">
                {consultation.price.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>

          <Card className="p-6 sm:p-8">
            <div className="prose prose-neutral max-w-none">
              {description.split('\n\n').map((paragraph: string, index: number) => (
                <p key={index} className="mb-4 text-neutral-600 leading-relaxed whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          </Card>

        </motion.div>

        {/* Booking form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="p-4 sm:p-6 lg:sticky lg:top-24">
            {isSubmitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send size={32} className="text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">Заявка отправлена!</h3>
                <p className="text-neutral-600 mb-6">
                  Мы свяжемся с вами в ближайшее время для подтверждения записи.
                </p>
                <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                  Отправить ещё
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-neutral-900 mb-6">Записаться на консультацию</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Ваше имя *
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Как к вам обращаться"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Телефон *
                    </label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      placeholder="+7 (999) 123-45-67"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      <Calendar size={16} className="inline mr-1" />
                      Желаемая дата
                    </label>
                    <Input
                      type="date"
                      value={formData.preferredDate}
                      onChange={(e) => handleChange('preferredDate', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Комментарий
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => handleChange('message', e.target.value)}
                      placeholder="Расскажите о вашем запросе или пожеланиях..."
                      rows={3}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 transition focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    />
                  </div>

                  <div className="pt-4 border-t border-neutral-100">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-neutral-600">Стоимость:</span>
                      <span className="text-2xl font-display text-primary-700">
                        {consultation.price.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <Button type="submit" fullWidth size="lg" disabled={isSubmitting}>
                      {isSubmitting ? 'Отправка...' : 'Записаться'}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
