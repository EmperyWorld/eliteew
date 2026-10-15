import { ADMIN_ROUTES } from '@constants/adminRoutes';
import {
    Calendar,
    Cog,
    FileText,
    GraduationCap,
    Image,
    Layers,
    LayoutDashboard,
    MessageSquare,
    Package,
    Palette,
    Presentation,
    Settings,
    ShoppingBag,
    ShoppingCart,
    SlidersHorizontal,
    TrendingUp,
    Users,
    Wand2,
    type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
  badge?: boolean;
  color?: string;
}

export interface NavGroup {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  color?: string;
}

export const navGroups: NavGroup[] = [
  {
    title: 'Обзор',
    icon: TrendingUp,
    color: 'text-emerald-500',
    items: [
      { to: ADMIN_ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard', exact: true, color: 'emerald' },
    ],
  },
  {
    title: 'Продажи',
    icon: ShoppingBag,
    color: 'text-orange-500',
    items: [
      { to: ADMIN_ROUTES.ORDERS, icon: ShoppingCart, label: 'Заказы', badge: true, color: 'orange' },
      { to: ADMIN_ROUTES.BOOKINGS, icon: Users, label: 'Записи', badge: true, color: 'purple' },
      { to: ADMIN_ROUTES.SCHEDULE, icon: Calendar, label: 'Расписание', color: 'blue' },
    ],
  },
  {
    title: 'Каталог',
    icon: Layers,
    color: 'text-blue-500',
    items: [
      { to: ADMIN_ROUTES.PRODUCTS, icon: Package, label: 'Товары', color: 'primary' },
      { to: ADMIN_ROUTES.CONSULTATIONS, icon: MessageSquare, label: 'Консультации', color: 'purple' },
      { to: ADMIN_ROUTES.MASTERCLASSES, icon: GraduationCap, label: 'Мастер-классы', color: 'blue' },
    ],
  },
  {
    title: 'Контент',
    icon: Wand2,
    color: 'text-pink-500',
    items: [
      { to: ADMIN_ROUTES.GALLERY, icon: Image, label: 'Галерея', color: 'pink' },
      { to: ADMIN_ROUTES.CONTENT, icon: FileText, label: 'Контент', color: 'amber' },
      { to: ADMIN_ROUTES.PRESENTATIONS, icon: Presentation, label: 'Презентации', color: 'blue' },
      { to: ADMIN_ROUTES.CUSTOMIZATION, icon: Palette, label: 'Кастомизация', color: 'violet' },
    ],
  },
  {
    title: 'Система',
    icon: Cog,
    color: 'text-neutral-500',
    items: [
      { to: ADMIN_ROUTES.SETTINGS, icon: Settings, label: 'Настройки', color: 'neutral' },
      { to: ADMIN_ROUTES.CONFIG, icon: SlidersHorizontal, label: 'Конфиг', color: 'neutral' },
    ],
  },
];

// Flat list for backward compatibility
export const navItems = navGroups.flatMap((group) => group.items);
