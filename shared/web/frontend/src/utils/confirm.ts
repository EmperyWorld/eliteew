export const isBrowserEnvironment = typeof window !== 'undefined';

/**
 * Унифицированный helper для подтверждения действий.
 * Сейчас использует window.confirm, но позволяет в будущем
 * заменить нативный диалог на кастомное модальное окно.
 */
export const confirmAction = (message: string): boolean => {
	if (isBrowserEnvironment && typeof window.confirm === 'function') {
		// eslint-disable-next-line no-alert
		return window.confirm(message);
	}

	// В средах без window (SSR / тесты) считаем, что пользователь отменил действие.
	return false;
};
