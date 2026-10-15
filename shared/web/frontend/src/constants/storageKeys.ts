/**
 * Ключи sessionStorage и важные ключи localStorage для shell-навигации
 * (единая точка, без дрейфа строк).
 */

export const PROFILE_RETURN_TO_SESSION_KEY = 'profile_return_to' as const;

/** Сегмент маршрута для возврата после SSO login (без `#`). */
export const INTENDED_PAGE_SESSION_KEY = 'intended_page' as const;

/** localStorage: последний полноэкранный маршрут после `SET_CURRENT_PAGE` (не `login`). */
export const LAST_VISITED_PAGE_LOCAL_KEY = 'lastVisitedPage' as const;
