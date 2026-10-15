/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Page labels and navigation config for shell announcements and return-to-world UX.
 *
 * Invariants:
 * - Labels are user-facing and must follow EliteEW product terminology.
 * - Route ids stay stable; only visible labels may change here.
 *
 * Related:
 * - `components/ui/BackToDesktopButton.tsx`
 */

import type { PageType } from '../hooks/useAppState';

/** Human-readable labels for each PageType (for nav and a11y). */
export const PAGE_LABELS: Partial<Record<PageType, string>> = {
	desktop: 'Безраздельный мир',
	'desktop/store': 'Магазин приложений',
	'video-studio': 'Студия видео',
	dashboard: 'Дашборд',
	'elite-dashboard-v3': 'UGS',
	'unified-content': 'Менеджер контента',
	'voice-studio': 'Голосовая студия',
	'audio-transcription': 'Транскрипция',
	'document-editor': 'Редактор документов',
	configuration: 'Конфигурация',
	admin: 'Админ-панель',
	'desktop-admin': 'Админка магазина приложений',
	login: 'Вход',
	'mobile-app-download': 'Мобильное приложение',
	'mobile-ewa-companion': 'EWA · спутник',
	'mobile-handbook': 'Справочная Навигация',
	'mobile-social-hub': 'Social Hub',
	'mobile-feedback-hub': 'Обращения',
	'mobile-notifications': 'Центр уведомлений',
	'mobile-content-manager': 'Файловый менеджер',
	'mobile-ewdesk': 'EWDesk',
	'mobile-professional-worlds': 'Professional Worlds',
	'mobile-app-store': 'Магазин приложений',
	'mobile-desktop-settings': 'Настройки рабочего стола',
	'empery-nexus': 'Empery Nexus · Chronicle',
	'user-profile': 'Профиль',
	ugs: 'UGS',
	'ugs-hub': 'UGS Хаб',
	'ugs-admin': 'UGS Админ',
	'ugs-analytics': 'UGS Аналитика',
	ewrp: 'EWRP — Революционные презентации',
};

export function getPageLabel(page: PageType): string {
	return PAGE_LABELS[page] ?? page;
}
