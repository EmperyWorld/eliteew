import { Button } from '@components/atoms/Button'
import { HeroSection } from '@components/organisms/HeroSection'
import { ProductGroupGrid } from '@components/organisms/ProductGroupGrid'
import { HomePageSkeleton, PageLoadError } from '@components/storefront/StorefrontSkeletons'
import { ROUTES } from '@constants/routes'
import { resolveSiteSettings } from '@constants/siteDefaults'
import { homeImages } from '@constants/siteImages'
import { usePageContent } from '@hooks/usePageContent'
import { useProducts } from '@services/api/products'
import { heroContentFromBlocks } from '@utils/contentBlocks'
import { groupProductsByName } from '@utils/productGrouping'
import { BookOpen, Compass, HeartHandshake, Leaf, Sparkles, Star } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'

const PAGE = 'home'

export const HomePage: React.FC = () => {
  const { data: productsData, isLoading } = useProducts({ inStock: 'true' })
  const navigate = useNavigate()
  const siteTitle = resolveSiteSettings(useSiteSettingsStore((s) => s.siteSettings)).siteTitle?.trim() || 'Сайт'
  const { contentBlocks, contentStatus, getBlock, getImage, isContentReady, isContentError, reload } = usePageContent(PAGE, {
    includeImages: true,
  })

  const whyItems = [
    { icon: Sparkles, titleKey: 'item1_title', descKey: 'item1_description' },
    { icon: HeartHandshake, titleKey: 'item2_title', descKey: 'item2_description' },
    { icon: Star, titleKey: 'item3_title', descKey: 'item3_description' },
    { icon: Compass, titleKey: 'item4_title', descKey: 'item4_description' },
  ]
  const waysItems = [
    { titleKey: 'item1_title', descKey: 'item1_description' },
    { titleKey: 'item2_title', descKey: 'item2_description' },
    { titleKey: 'item3_title', descKey: 'item3_description' },
    { titleKey: 'item4_title', descKey: 'item4_description' },
  ]

  const productGroups = React.useMemo(() => {
    const products = productsData?.data ?? []
    return groupProductsByName(products)
  }, [productsData])

  const handleViewDetails = (groupId: string) => {
    navigate(`/shop/${groupId}`)
  }

  if (contentStatus === 'loading') {
    return <HomePageSkeleton />
  }

  if (isContentError) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-20">
        <PageLoadError label="Не удалось загрузить контент главной страницы." onRetry={reload} />
      </div>
    )
  }

  if (!isContentReady || !contentBlocks) {
    return <HomePageSkeleton />
  }

  const heroContent = heroContentFromBlocks(contentBlocks, PAGE)
  const portraitSrc = getImage('about_preview', 'portrait', homeImages.aboutPreviewPortrait)

  return (
    <div className="min-h-screen">
      <HeroSection content={heroContent} />

      <section className="container mx-auto px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center">
          <div className="relative">
            <div className="absolute -inset-6 rounded-[36px] bg-gradient-to-br from-primary-200/35 via-accent-200/20 to-neutral-100/25 blur-3xl" />
            <div
              className="relative overflow-hidden rounded-[32px] border shadow-floating backdrop-blur-xl"
              style={{
                background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.8))',
                borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.6))',
              }}
            >
              {portraitSrc ? (
                <img src={portraitSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="aspect-[3/4] w-full animate-pulse bg-neutral-200/70" aria-hidden />
              )}
            </div>
          </div>

          <div className="space-y-6">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.45em] text-neutral-500 backdrop-blur-sm"
              style={{
                background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.7))',
                borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
              }}
            >
              {getBlock('about_preview', 'greeting', 'Здравствуйте')}
            </span>
            <h2 className="text-4xl sm:text-5xl font-display text-neutral-900">
              {getBlock('about_preview', 'title', 'О студии')}
            </h2>
            <p className="text-lg text-neutral-600 leading-relaxed">
              {getBlock(
                'about_preview',
                'description_1',
                `Кратко опишите бренд и миссию — текст настраивается в разделе контента. Сейчас в подзаголовке используется название: ${siteTitle}.`,
              )}
            </p>
            <p className="text-lg text-neutral-600 leading-relaxed">
              {getBlock(
                'about_preview',
                'description_2',
                'Дополнительный абзац о подходе, ценностях и формате работы с клиентами.',
              )}
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                variant="outline"
                onClick={() => navigate(ROUTES.CONSULTATIONS)}
                className="inline-flex items-center gap-2 rounded-3xl px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em]"
              >
                {getBlock('about_preview', 'cta_consultation', 'Записаться на консультацию')}
              </Button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.SHOP)}
                className="inline-flex items-center gap-2 rounded-3xl border px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500 transition-all duration-300 backdrop-blur-sm"
                style={{
                  background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.7))',
                  borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--theme-highlight, rgba(79, 143, 127, 0.3))'
                  e.currentTarget.style.color = 'var(--theme-highlight, #29584c)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))'
                  e.currentTarget.style.color = 'var(--theme-body-text, rgba(55, 82, 72, 0.5))'
                }}
              >
                {getBlock('about_preview', 'cta_shop', 'Открыть каталог')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        className="py-20"
        style={{
          background: 'var(--gradient-app, linear-gradient(135deg, rgba(241, 247, 244, 0.95) 0%, rgba(255, 255, 255, 0.98) 50%, rgba(255, 247, 232, 0.95) 100%))',
        }}
      >
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h3 className="text-3xl sm:text-4xl font-display text-neutral-900 mb-4">
              {getBlock('why_choose', 'section_title', `Почему выбирают ${siteTitle}`)}
            </h3>
            <p className="mx-auto max-w-3xl text-neutral-600">
              {getBlock(
                'why_choose',
                'section_subtitle',
                'Коротко сформулируйте выгоды и отличия — блоки ниже заполняются в админке.',
              )}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {whyItems.map(({ icon: Icon, titleKey, descKey }) => (
              <div
                key={titleKey}
                className="group relative overflow-hidden rounded-3xl border p-6 shadow-outline transition-all duration-300 hover:-translate-y-1 backdrop-blur-xl"
                style={{
                  background: 'var(--theme-glass-surface, linear-gradient(135deg, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0.45)))',
                  borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.4))',
                }}
              >
                <div
                  className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition-colors"
                  style={{
                    background: 'var(--theme-highlight, rgba(79, 143, 127, 0.15))',
                    color: 'var(--theme-highlight, #29584c)',
                    boxShadow: 'var(--theme-card-shadow, 0 10px 30px -15px rgba(79, 143, 127, 0.4))',
                  }}
                >
                  <Icon size={22} />
                </div>
                <h4
                  className="mb-3 text-lg font-semibold"
                  style={{ color: 'var(--theme-heading-color, #112923)' }}
                >
                  {getBlock('why_choose', titleKey, '')}
                </h4>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--theme-body-text, rgba(55, 82, 72, 0.75))' }}
                >
                  {getBlock('why_choose', descKey, '')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.45em] text-neutral-500 backdrop-blur-sm"
              style={{
                background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.7))',
                borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
              }}
            >
              {getBlock('ways_to_work', 'badge', 'Как мы работаем')}
            </span>
            <h3 className="text-3xl sm:text-4xl font-display text-neutral-900">
              {getBlock('ways_to_work', 'title', 'Форматы работы')}
            </h3>
            <p className="text-lg text-neutral-600 leading-relaxed">
              {getBlock(
                'ways_to_work',
                'intro',
                'Опишите доступные форматы: консультации, услуги, мероприятия — текст задаётся в контенте.',
              )}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {waysItems.map(({ titleKey, descKey }) => (
                <div
                  key={titleKey}
                  className="rounded-3xl border p-5 shadow-sm backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
                  style={{
                    background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.85))',
                    borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
                  }}
                >
                  <h4 className="text-base font-semibold text-neutral-900 mb-2">{getBlock('ways_to_work', titleKey, '')}</h4>
                  <p className="text-sm text-neutral-600 leading-relaxed">{getBlock('ways_to_work', descKey, '')}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="relative rounded-[32px] border p-8 shadow-floating backdrop-blur-xl"
            style={{
              background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.85))',
              borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
            }}
          >
            <div className="absolute -top-5 left-8 inline-flex items-center gap-2 rounded-full border border-primary-200/70 bg-primary-50/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-primary-700">
              <BookOpen size={16} />
              {getBlock('value_block', 'badge', 'Дополнительный блок')}
            </div>
            <div className="space-y-5 pt-8 text-neutral-600">
              <p>
                -{' '}
                {getBlock(
                  'value_block',
                  'paragraph_1',
                  `Расширенный текст о сервисе или продукте. Можно сослаться на название: ${siteTitle}.`,
                )}
              </p>
              <p>- {getBlock('value_block', 'paragraph_2', 'Второй абзац — детали процесса или преимуществ.')}</p>
              <p>- {getBlock('value_block', 'paragraph_3', 'Третий абзац — призыв или итог.')}</p>
              <button
                type="button"
                onClick={() => navigate(ROUTES.CONSULTATIONS)}
                className="inline-flex items-center gap-2 rounded-2xl border border-primary-300/60 bg-primary-100/50 px-5 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-primary-700 transition-all duration-300 hover:border-primary-500 hover:bg-primary-100"
              >
                {getBlock('value_block', 'cta', 'Подробнее')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20 relative">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-primary-400 to-transparent" />

        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary-200/50 mb-6">
            <Leaf className="w-5 h-5 text-primary-600" />
            <span className="text-sm font-medium text-primary-700">
              {getBlock('products_section', 'badge', `Каталог ${siteTitle}`)}
            </span>
          </div>
          <h2 className="text-5xl md:text-6xl font-display font-bold mb-4">
            <span className="gradient-text">{getBlock('products_section', 'headline_1', 'Избранное')}</span>
            <br />
            <span className="text-gray-900">{getBlock('products_section', 'headline_2', 'в каталоге')}</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {getBlock('products_section', 'subtitle', 'Подзаголовок к товарному блоку редактируется в контенте.')}
          </p>
        </div>

        <ProductGroupGrid
          productGroups={productGroups.slice(0, 8)}
          isLoading={isLoading}
          onViewDetails={handleViewDetails}
        />
      </section>
    </div>
  )
}
