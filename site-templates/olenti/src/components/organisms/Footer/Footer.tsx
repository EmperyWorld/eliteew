import { resolveSiteSettings } from '@constants/siteDefaults'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import { Leaf, Mail, Phone } from 'lucide-react'
import React, { memo } from 'react'
import { Link } from 'react-router-dom'

// Memoized style for overlay pattern
const overlayStyle = {
  backgroundImage: 'var(--theme-overlay-pattern, url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\' viewBox=\'0 0 160 160\'%3E%3Cpath fill=\'%23ffffff\' fill-opacity=\'0.06\' d=\'M0 0h40v40H0zM80 80h40v40H80z\'/%3E%3C/svg%3E"))',
  opacity: 'var(--theme-overlay-opacity, 0.35)',
} as const

type FooterContact = {
  icon: typeof Phone | typeof Mail
  href: string
  text: string
}

const FooterComponent: React.FC = () => {
  const settingsLoaded = useSiteSettingsStore((state) => state.settingsLoaded)
  const settings = resolveSiteSettings(useSiteSettingsStore((state) => state.siteSettings))

  const contactPhone = settings.contactPhone?.trim()
  const contactEmail = settings.contactEmail?.trim()
  const siteTitle = settingsLoaded ? settings.siteTitle?.trim() || 'Сайт' : ''
  const siteDescription = settingsLoaded ? settings.siteDescription?.trim() || '' : ''
  const contacts: FooterContact[] = [
    ...(contactPhone
      ? [{ icon: Phone, href: `tel:${contactPhone.replace(/[^\d+]/g, '')}`, text: contactPhone }]
      : []),
    ...(contactEmail ? [{ icon: Mail, href: `mailto:${contactEmail}`, text: contactEmail }] : []),
  ]

  return (
    <footer className="relative mt-24 overflow-hidden theme-footer-text">
      <div className="absolute inset-0 theme-footer-bg" />
      <div
        className="pointer-events-none absolute inset-0 opacity-35 mix-blend-soft-light"
        style={overlayStyle}
      />

      <div className="relative z-10 container mx-auto px-2 py-12 sm:px-4 sm:py-16 md:px-6 md:py-20 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl theme-footer-surface">
                <Leaf className="h-7 w-7 theme-footer-icon" />
              </span>
              {settingsLoaded ? (
                <h3 className="text-2xl font-display font-semibold theme-footer-heading">{siteTitle}</h3>
              ) : (
                <span className="h-8 w-40 animate-pulse rounded-lg bg-white/10" aria-hidden />
              )}
            </div>
            {settingsLoaded ? (
              siteDescription ? (
                <p className="text-sm leading-relaxed theme-footer-text">{siteDescription}</p>
              ) : null
            ) : (
              <div className="space-y-2" aria-hidden>
                <span className="block h-3 w-full max-w-md animate-pulse rounded bg-white/10" />
                <span className="block h-3 w-full max-w-sm animate-pulse rounded bg-white/10" />
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-5 text-lg font-semibold theme-footer-heading">
              Контакты
            </h4>
            <ul className="space-y-4 text-sm">
              {contacts.map((contact) => (
                <li key={contact.href} className="group flex items-center gap-3">
                  <div className="rounded-2xl p-3 transition-colors group-hover:opacity-80 theme-footer-surface">
                    <contact.icon size={18} className="theme-footer-icon" />
                  </div>
                  <a
                    href={contact.href}
                    className="transition-colors duration-300 theme-footer-link"
                  >
                    {contact.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 border-t pt-8 theme-footer-border">
          <div className="flex flex-col items-center justify-between gap-4 text-sm md:flex-row theme-footer-text">
            <p>
              &copy; {new Date().getFullYear()}
              {settingsLoaded && siteTitle ? ` ${siteTitle}.` : null} Все права защищены.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {[
                { to: '#', label: 'Политика конфиденциальности' },
                { to: '#', label: 'Условия использования' },
              ].map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="transition-colors duration-300 theme-footer-link"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export const Footer = memo(FooterComponent)
