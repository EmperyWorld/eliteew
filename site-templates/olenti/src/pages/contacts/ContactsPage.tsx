import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { Input } from '@components/atoms/Input'
import { Typography } from '@components/atoms/Typography'
import { resolveSiteSettings } from '@constants/siteDefaults'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import { motion } from 'framer-motion'
import { Clock, Mail, MapPin, MessageSquareHeart, Phone, Send } from 'lucide-react'
import React from 'react'

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
}

const quickLinks = [
  {
    title: 'Консультации и услуги',
    description: 'Индивидуальные форматы работы — настройте тексты в админке.',
    action: 'Подробнее',
  },
  {
    title: 'События',
    description: 'Мастер-классы и встречи — см. соответствующий раздел сайта.',
    action: 'Расписание',
  },
]

export const ContactsPage: React.FC = () => {
  const settingsLoaded = useSiteSettingsStore((state) => state.settingsLoaded)
  const siteSettings = resolveSiteSettings(useSiteSettingsStore((state) => state.siteSettings))

  const contactPhone = siteSettings.contactPhone?.trim() || ''
  const contactEmail = siteSettings.contactEmail?.trim() || ''
  const contactAddress = siteSettings.contactAddress?.trim() || ''
  const workingHours = siteSettings.workingHours?.trim() || ''
  const siteTitle = settingsLoaded ? siteSettings.siteTitle?.trim() || 'Сайт' : ''

  const contactDetails = [
    {
      icon: Phone,
      title: 'Телефон',
      value: contactPhone,
      href: `tel:${contactPhone.replace(/[^\d+]/g, '')}`,
    },
    {
      icon: Mail,
      title: 'Email',
      value: contactEmail,
      href: `mailto:${contactEmail}`,
    },
    {
      icon: MapPin,
      title: 'Адрес',
      value: contactAddress,
      href: `https://yandex.ru/maps/?text=${encodeURIComponent(contactAddress)}`,
    },
    {
      icon: Clock,
      title: 'Режим работы',
      value: workingHours,
    },
  ].filter((row) => row.value.length > 0)

  if (!settingsLoaded) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl space-y-4">
          <span className="block h-10 w-48 animate-pulse rounded-xl bg-neutral-200/80" />
          <span className="block h-14 w-full animate-pulse rounded-xl bg-neutral-200/80" />
          <span className="block h-24 w-full animate-pulse rounded-xl bg-neutral-200/70" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-16 sm:py-20">
      <motion.section
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        className="relative overflow-hidden rounded-[40px] border px-6 py-14 shadow-[0_45px_140px_-65px_rgba(17,55,34,0.35)] backdrop-blur-2xl sm:px-10"
        style={{
          background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.8))',
          borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.55))',
        }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[40px] bg-gradient-to-br from-primary-200/25 via-white/60 to-accent-200/20" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-6">
            <div
              className="inline-flex items-center gap-3 rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.45em] text-neutral-500 backdrop-blur-sm"
              style={{
                background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.75))',
                borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
              }}
            >
              <MessageSquareHeart size={16} className="text-[color:var(--theme-highlight,#4f8f7f)]" />
              Контакты и связи
            </div>
            <Typography variant="h1" className="text-balance text-4xl leading-tight sm:text-5xl lg:text-6xl">
              <span className="gradient-text">Свяжитесь</span>{' '}
              <span className="text-neutral-900">с командой {siteTitle}</span>
            </Typography>
            <Typography variant="p" className="max-w-xl text-base text-neutral-600 sm:text-lg">
              Оставьте сообщение — команда ответит и подскажет следующий шаг. Тексты страницы можно изменить в админке.
            </Typography>
          </div>
          <Card
            variant="solid"
            shadow="sm"
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border backdrop-blur-md"
            style={{
              background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.85))',
              borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
            }}
          >
            <div className="relative space-y-4">
              <h3 className="text-lg font-semibold uppercase tracking-[0.35em] text-neutral-500">Коротко</h3>
              <div className="space-y-4">
                {quickLinks.map((link) => (
                  <div
                    key={link.title}
                    className="rounded-2xl border p-4 backdrop-blur-sm"
                    style={{
                      background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.7))',
                      borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.6))',
                    }}
                  >
                    <p className="text-sm font-semibold text-neutral-800">{link.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">{link.description}</p>
                    <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--theme-highlight,#4f8f7f)]">
                      {link.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </motion.section>

      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={sectionVariants}
        className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
      >
        {contactDetails.map((detail) => (
          <motion.div key={detail.title} variants={itemVariants}>
            <Card variant="solid" hover shadow="sm" className="h-full rounded-3xl">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--theme-muted,rgba(17,41,35,0.08))] text-[color:var(--theme-highlight,#4f8f7f)]">
                  <detail.icon size={24} />
                </span>
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-neutral-400">{detail.title}</p>
                  {detail.href ? (
                    <a
                      href={detail.href}
                      target={detail.href.startsWith('http') ? '_blank' : undefined}
                      rel={detail.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="mt-1 inline-flex items-center text-lg font-display text-neutral-900 transition-colors hover:text-[color:var(--theme-highlight,#4f8f7f)]"
                    >
                      {detail.value}
                    </a>
                  ) : (
                    <p className="mt-1 text-lg font-display text-neutral-900">{detail.value}</p>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.section>

      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={sectionVariants}
        className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
      >
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-[32px] border p-8 shadow-[0_45px_120px_-65px_rgba(17,55,34,0.32)] backdrop-blur-2xl"
          style={{
            background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.8))',
            borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.6))',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom right, var(--theme-muted, rgba(17,41,35,0.08)) 70%, transparent)',
            }}
          />
          <div className="relative grid gap-6 sm:grid-cols-2">
            <div className="space-y-5">
              <h3 className="text-2xl font-display text-neutral-900">Как проходит консультация</h3>
              <ul className="space-y-4 text-sm text-neutral-600">
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--theme-highlight,#4f8f7f)]/15 text-xs font-semibold text-[color:var(--theme-highlight,#4f8f7f)]">
                    1
                  </span>
                  Предварительный созвон и уточнение задачи.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--theme-highlight,#4f8f7f)]/15 text-xs font-semibold text-[color:var(--theme-highlight,#4f8f7f)]">
                    2
                  </span>
                  Встреча в студии или онлайн — разбор контекста и ожиданий.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--theme-highlight,#4f8f7f)]/15 text-xs font-semibold text-[color:var(--theme-highlight,#4f8f7f)]">
                    3
                  </span>
                  Подбор решения и сопровождение до результата.
                </li>
              </ul>
            </div>
            <div className="rounded-3xl border border-white/60 bg-white/75 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-neutral-400">Ритуалы событий</p>
              <p className="mt-3 text-lg font-display text-neutral-900">Корпоративные форматы и мероприятия</p>
              <p className="mt-2 text-sm text-neutral-600">
                Здесь можно описать корпоративные форматы, приватные встречи или другой сервис, который нужен вашему проекту.
              </p>
              <div
                className="mt-5 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--theme-highlight,#4f8f7f)] backdrop-blur-sm"
                style={{
                  background: 'var(--theme-glass-surface, rgba(255, 255, 255, 0.8))',
                  borderColor: 'var(--theme-glass-border, rgba(255, 255, 255, 0.7))',
                }}
              >
                По запросу · от 8 человек
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card variant="glass" shadow="md" className="space-y-6">
            <Typography variant="h2" className="text-3xl font-display text-neutral-900">
              Напишите нам
            </Typography>
            <p className="text-sm text-neutral-600">
              Расскажите о событии, желаемом настроении или любимых нотах — мы подготовим персональное предложение.
            </p>
            <form className="space-y-4">
              <Input type="text" placeholder="Имя и фамилия" aria-label="Имя и фамилия" />
              <Input type="email" placeholder="Email" aria-label="Email" />
              <Input type="tel" placeholder="Телефон" aria-label="Телефон" />
              <textarea
                rows={5}
                placeholder="Что вы ищете? Например: «Консультация по проекту» или «Подарочный набор услуг»"
                className="w-full rounded-2xl border border-[color:var(--theme-card-border,rgba(255,255,255,0.55))] bg-[color:var(--theme-card-surface,rgba(255,255,255,0.92))] px-4 py-3 text-sm text-neutral-700 transition focus:border-[color:var(--theme-highlight,#4f8f7f)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-highlight,#4f8f7f)]/20"
              />
              <Button
                type="submit"
                fullWidth
                size="lg"
                className="group relative overflow-hidden text-white shadow-floating transition-all duration-300 hover:scale-[1.01]"
                style={{
                  background: 'linear-gradient(to right, var(--theme-highlight, #4f8f7f), #4f8f7f, var(--theme-highlight, #4f8f7f))',
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Отправить заявку
                  <Send className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-[120%]" />
              </Button>
            </form>
          </Card>
        </motion.div>
      </motion.section>
    </div>
  )
}
