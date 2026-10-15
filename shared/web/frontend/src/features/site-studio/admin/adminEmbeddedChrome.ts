/**
 * Встроенная админка Site Studio в Desktop: те же CSS-переменные и примитивы, что у
 * {@link DESKTOP_APP_STYLE_CONTRACT} / портала, без полной перекраски standalone-режима.
 *
 * **Light CMS island:** route-guard/login surfaces use `data-site-studio-cms="island"` with
 * {@link ADMIN_CMS_LOADING_ISLAND_CLASS} — intentional tokenized mini-surface, not a clash with
 * full embedded chrome ({@link ADMIN_EMBEDDED_ROOT_CLASS}). Standalone admin keeps neutral palette.
 *
 * Приоритет вычищения «сырого» neutral/slate на экранах (поэтапно):
 * @see ADMIN_EMBEDDED_STYLE_PRIORITY_ROUTES
 */
import { cn } from '@/utils/cn';
import { DESKTOP_APP_STYLE_CONTRACT } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

/** Маршруты (basename-agnostic): следующие крупные страницы для выравнивания стилей. */
export const ADMIN_EMBEDDED_STYLE_PRIORITY_ROUTES = [
	'/',
	'/orders',
	'/presentations',
] as const;

export const ADMIN_EMBEDDED_ROOT_CLASS = cn(
	'flex h-full min-h-0 relative overflow-hidden transition-colors duration-300',
	DESKTOP_APP_STYLE_CONTRACT.shell
);

/** Основная карточка контента под Outlet */
export const ADMIN_EMBEDDED_MAIN_PANEL_CLASS = cn(
	DESKTOP_APP_STYLE_CONTRACT.panel,
	'shadow-sm'
);

export const ADMIN_EMBEDDED_FOOTER_CLASS = cn(
	'border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 backdrop-blur-sm text-(--desktop-text-muted)',
	DESKTOP_TYPOGRAPHY.meta
);

/** Боковая колонка во встроенном режиме */
export const ADMIN_EMBEDDED_SIDEBAR_SHELL_CLASS = cn(
	'relative h-full shrink-0 flex flex-col translate-x-0 shadow-none backdrop-blur-xl',
	'bg-(--desktop-surface-panel) border-r border-(--desktop-border-subtle)'
);

/** Верхняя полоса админки во встроенном режиме */
export const ADMIN_EMBEDDED_HEADER_SHELL_CLASS = cn(
	'sticky top-0 z-30 flex items-center justify-between backdrop-blur-xl transition-colors duration-300',
	'border-b border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/95'
);

/** Tokenized light island for CMS auth/bootstrap (route guard, login). */
export const ADMIN_CMS_LOADING_ISLAND_CLASS = cn(
	'flex min-h-screen items-center justify-center',
	DESKTOP_APP_STYLE_CONTRACT.shell
);

export const ADMIN_CMS_LOADING_CARD_CLASS = cn(
	DESKTOP_APP_STYLE_CONTRACT.panel,
	'flex flex-col items-center gap-3 px-10 py-8 text-center shadow-lg shadow-[rgb(var(--desktop-accent-rgb)/0.08)]'
);
