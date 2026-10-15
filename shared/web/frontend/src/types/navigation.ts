/**
 * Navigation Types
 *
 * Типы для навигации между страницами приложения.
 * Обеспечивает совместимость между строгим типом PageType и гибким string типом.
 */

import type { PageType } from '../hooks/useAppState';

/**
 * Обработчик навигации, который принимает как строгий PageType, так и произвольную строку.
 * Это позволяет компонентам быть гибкими при сохранении типобезопасности.
 */
export type NavigationHandler = (page: PageType | string) => void;

/**
 * Альтернативное имя для совместимости с другими частями кода
 */
export type RouteHandler = NavigationHandler;

/**
 * Пропсы компонента с поддержкой навигации
 */
export interface NavigationProps {
	onNavigate?: NavigationHandler;
	onPageChange?: NavigationHandler;
	handlePageChange?: NavigationHandler;
}
