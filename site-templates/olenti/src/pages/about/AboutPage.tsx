import { Button } from '@components/atoms/Button'
import { DiplomasGallery } from '@components/organisms/DiplomasGallery'
import { InnerPageSkeleton, PageLoadError } from '@components/storefront/StorefrontSkeletons'
import { ROUTES } from '@constants/routes'
import { resolveSiteSettings } from '@constants/siteDefaults'
import { aboutImages } from '@constants/siteImages'
import { usePageContent } from '@hooks/usePageContent'
import { motion } from 'framer-motion'
import {
    Droplet,
    Feather,
    FlaskConical,
    Heart,
    Leaf,
    Send,
    Sparkles,
    Sprout,
    Stars,
} from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'

const valueIcons = [Sprout, FlaskConical, Heart]
const processIcons = [Sparkles, Leaf, Droplet, Feather]

export const AboutPage: React.FC = () => {
  const navigate = useNavigate()
  const siteTitle = resolveSiteSettings(useSiteSettingsStore((s) => s.siteSettings)).siteTitle?.trim() || 'Сайт'
  const { contentStatus, getBlock, getImage, isContentReady, isContentError, reload } = usePageContent('about', {
    includeImages: true,
  })

  if (contentStatus === 'loading') {
    return <InnerPageSkeleton withHeroImage />
  }
  if (isContentError) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-20">
        <PageLoadError label="Не удалось загрузить контент страницы «О нас»." onRetry={reload} />
      </div>
    )
  }
  if (!isContentReady) {
    return <InnerPageSkeleton withHeroImage />
  }

  return (
    <div className="relative overflow-hidden">
      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary-100/20 to-transparent" />
        <div className="container mx-auto px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="space-y-8"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-primary-700">
                {getBlock('hero', 'badge', siteTitle)}
              </span>
              <h1 className="text-4xl font-display leading-[1.1] text-neutral-900 sm:text-5xl lg:text-6xl">
                {getBlock('hero', 'title', 'О бренде и команде')}
              </h1>
              <p className="text-lg leading-relaxed text-neutral-600 sm:text-xl">
                {getBlock(
                  'hero',
                  'description',
                  `Краткое введение о ${siteTitle}. Полный текст задаётся в разделе контента.`,
                )}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((i, index) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 + index * 0.1, ease: 'easeOut' }}
                    className="rounded-3xl border border-white/50 bg-white/75 p-5 text-center backdrop-blur-xl shadow-outline"
                  >
                    <div className="text-3xl font-display text-primary-700">{getBlock('stats', `stat${i}_value`, '')}</div>
                    <p className="mt-2 text-sm text-neutral-600">{getBlock('stats', `stat${i}_label`, '')}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
              className="relative rounded-[28px] overflow-hidden shadow-floating"
            >
              <img
                src={getImage('hero', 'atelier', aboutImages.atelier)}
                alt=""
                className="w-full h-full object-cover aspect-[4/3]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-center gap-3 text-white">
                  <Stars className="h-5 w-5" />
                  <span className="text-sm font-medium">{getBlock('hero', 'image_caption', 'Подпись к изображению')}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 lg:items-center">
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-[28px] overflow-hidden shadow-floating"
            >
              <img
                src={getImage('philosophy', 'ingredients', aboutImages.ingredients)}
                alt=""
                className="w-full h-auto object-cover"
              />
            </motion.div>
            <h2 className="text-3xl font-display text-neutral-900 sm:text-4xl">
              {getBlock('philosophy', 'title', `Что определяет философию ${siteTitle}`)}
            </h2>
            <p className="text-base leading-relaxed text-neutral-600 sm:text-lg">
              {getBlock('philosophy', 'description', 'Опишите ценности и принципы бренда в админке контента.')}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {[1, 2, 3].map((i, index) => {
              const Icon = valueIcons[index]
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.6, delay: index * 0.15, ease: 'easeOut' }}
                  className="rounded-3xl border border-white/55 bg-white/70 p-6 backdrop-blur-xl shadow-outline"
                >
                  <Icon className="h-9 w-9 text-primary-600" />
                  <h3 className="mt-4 text-lg font-semibold text-neutral-900">{getBlock('philosophy', `value${i}_title`, '')}</h3>
                  <p className="mt-2 text-sm text-neutral-600">{getBlock('philosophy', `value${i}_description`, '')}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="relative py-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/30 via-transparent to-white/30" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-white/60 bg-white/75 p-8 backdrop-blur-xl shadow-floating sm:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
              <div className="space-y-5">
                <h2 className="text-3xl font-display text-neutral-900 sm:text-4xl">
                  {getBlock('process', 'title', 'Ремесло, в котором важна каждая деталь')}
                </h2>
                <p className="text-base leading-relaxed text-neutral-600 sm:text-lg">
                  {getBlock('process', 'description', 'Опишите этапы работы с клиентом — текст из контент-блоков.')}
                </p>
                <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/65 p-4 text-sm text-neutral-600 shadow-outline">
                  <Send className="h-4 w-4 text-primary-600" />
                  {getBlock(
                    'process',
                    'archive_note',
                    `Дополнительная заметка о процессе (настраивается в контенте). Бренд: ${siteTitle}.`,
                  )}
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i, index) => {
                  const Icon = processIcons[index]
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.6, delay: index * 0.1, ease: 'easeOut' }}
                      className="rounded-3xl border border-white/55 bg-white/70 p-5 backdrop-blur-xl shadow-outline"
                    >
                      <Icon className="h-8 w-8 text-primary-600" />
                      <h3 className="mt-4 text-lg font-semibold text-neutral-900">{getBlock('process', `step${i}_title`, '')}</h3>
                      <p className="mt-2 text-sm text-neutral-600">{getBlock('process', `step${i}_description`, '')}</p>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
          <div className="rounded-[28px] border border-white/60 bg-white/75 p-6 backdrop-blur-xl shadow-outline sm:p-8">
            <h2 className="text-3xl font-display text-neutral-900 sm:text-4xl">
              {getBlock('timeline', 'title', `История ${siteTitle}`)}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
              {getBlock('timeline', 'intro', 'Краткая история бренда — заполняется в контенте.')}
            </p>
            <div className="mt-6 space-y-4">
              {[1, 2, 3, 4].map((i, index) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: index * 0.1, ease: 'easeOut' }}
                  className="group flex gap-4 rounded-2xl border border-white/55 bg-white/70 p-4 transition-colors duration-300 hover:border-primary-200 hover:bg-white/90"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500/15 to-accent-500/15 text-lg font-display text-primary-700">
                    {getBlock('timeline', `item${i}_year`, '')}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">{getBlock('timeline', `item${i}_title`, '')}</h3>
                    <p className="mt-1 text-sm text-neutral-600">{getBlock('timeline', `item${i}_description`, '')}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/75 p-8 backdrop-blur-xl shadow-floating">
            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-primary-500/20 via-transparent to-accent-400/25 opacity-70" />
            <div className="relative space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/40">
                  <Sparkles className="h-6 w-6 text-primary-700" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">{getBlock('founder', 'name', 'Имя основателя')}</p>
                  <p className="text-sm font-semibold text-neutral-800">
                    {getBlock('founder', 'title', `Роль и связь с ${siteTitle}`)}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-neutral-600">
                {getBlock('founder', 'bio', 'Биография и опыт — текст из контент-блоков.')}
              </p>
              <div className="grid gap-4 rounded-2xl border border-white/55 bg-white/70 p-5 text-sm text-neutral-600 shadow-outline">
                <div className="flex items-center gap-3 text-neutral-700">
                  <Stars className="h-4 w-4 text-primary-600" />
                  {getBlock('founder', 'bullet1', 'Первый тезис о подходе или достижениях.')}
                </div>
                <div className="flex items-center gap-3 text-neutral-700">
                  <Sprout className="h-4 w-4 text-primary-600" />
                  {getBlock('founder', 'bullet2', 'Второй тезис — редактируется в админке.')}
                </div>
                <div className="flex items-center gap-3 text-neutral-700">
                  <Heart className="h-4 w-4 text-primary-600" />
                  {getBlock('founder', 'bullet3', 'Третий тезис — редактируется в админке.')}
                </div>
              </div>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(ROUTES.CONSULTATIONS)}
                className="w-full border-primary-300/70 bg-white/80 text-primary-700 hover:border-primary-500 hover:bg-white/90"
              >
                {getBlock('founder', 'cta_button', 'Записаться на личную встречу')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Diplomas Gallery */}
      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <DiplomasGallery />
      </section>

      <section className="relative pb-20">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary-100/20 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-white/60 bg-white/80 p-8 text-center backdrop-blur-xl shadow-floating sm:p-12">
            <h2 className="text-3xl font-display text-neutral-900 sm:text-4xl">
              {getBlock('cta_section', 'title', 'Свяжитесь с нами')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
              {getBlock('cta_section', 'description', 'Призыв к действию и контекст — настраиваются в контенте.')}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate(ROUTES.CONSULTATIONS)}
                className="group relative overflow-hidden bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 text-white shadow-floating transition-all duration-300 hover:scale-105"
              >
                <span className="relative z-10">{getBlock('cta_section', 'button_consultation', 'Запланировать консультацию')}</span>
                <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-[120%]" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate(ROUTES.SHOP)}
                className="border-white/50 bg-white/80 text-primary-700 hover:border-white/70 hover:bg-white/90"
              >
                {getBlock('cta_section', 'button_shop', 'Посмотреть коллекции')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
