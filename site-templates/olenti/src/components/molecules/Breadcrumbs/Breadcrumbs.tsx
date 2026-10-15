import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { ROUTES } from '@constants/routes'

interface BreadcrumbItem {
  label: string
  path?: string
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
  showHome?: boolean
  className?: string
}

// Автоматическое определение хлебных крошек по пути
const pathLabels: Record<string, string> = {
  shop: 'Магазин',
  cart: 'Корзина',
  checkout: 'Оформление',
  consultations: 'Консультации',
  masterclasses: 'Мастер-классы',
  about: 'О нас',
  contacts: 'Контакты',
  auth: 'Авторизация',
  login: 'Вход',
  register: 'Регистрация',
  account: 'Личный кабинет',
  profile: 'Профиль',
  orders: 'Заказы',
  favorites: 'Избранное',
  bookings: 'Записи',
  admin: 'Админ-панель',
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  showHome = true,
  className = '',
}) => {
  const location = useLocation()

  // Генерируем хлебные крошки из URL если items не переданы
  const breadcrumbs: BreadcrumbItem[] = items || (() => {
    const pathParts = location.pathname.split('/').filter(Boolean)
    const crumbs: BreadcrumbItem[] = []
    let currentPath = ''

    pathParts.forEach((part, index) => {
      currentPath += `/${part}`
      const label = pathLabels[part] || part
      
      // Последний элемент без ссылки
      if (index === pathParts.length - 1) {
        crumbs.push({ label })
      } else {
        crumbs.push({ label, path: currentPath })
      }
    })

    return crumbs
  })()

  if (breadcrumbs.length === 0) return null

  return (
    <nav
      aria-label="Навигация"
      className={`flex items-center gap-1 text-sm ${className}`}
    >
      {showHome && (
        <>
          <Link
            to={ROUTES.HOME}
            className="flex items-center gap-1 text-neutral-500 hover:text-primary-600 transition-colors"
          >
            <Home size={16} />
            <span className="hidden sm:inline">Главная</span>
          </Link>
          {breadcrumbs.length > 0 && (
            <ChevronRight size={16} className="text-neutral-300" />
          )}
        </>
      )}
      
      {breadcrumbs.map((item, index) => (
        <React.Fragment key={index}>
          {item.path ? (
            <Link
              to={item.path}
              className="text-neutral-500 hover:text-primary-600 transition-colors truncate max-w-32 sm:max-w-none"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-neutral-900 font-medium truncate max-w-40 sm:max-w-none">
              {item.label}
            </span>
          )}
          {index < breadcrumbs.length - 1 && (
            <ChevronRight size={16} className="text-neutral-300 shrink-0" />
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
