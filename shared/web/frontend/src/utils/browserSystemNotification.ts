/**
 * Системные уведомления ОС (Web Notifications API).
 * Нужны для UGS и др., когда вкладка в фоне — in-app toasts не видны.
 */

export type BrowserNotificationPermissionState = NotificationPermission;

export interface UgsBrowserNotificationOptions {
	/** Дедупликация и замена предыдущего тоста с тем же тегом */
	tag?: string;
	/** Вызывается при клике по уведомлению (фокус окна + пользовательский шаг). */
	onClick?: () => void;
}

/** Вкладка скрыта или окно браузера без фокуса (другая программа на экране). */
function isBrowserUnfocused(): boolean {
	if (typeof document === 'undefined') {
		return false;
	}
	return document.visibilityState === 'hidden' || !document.hasFocus();
}

/**
 * Запрос разрешения (нужен жест пользователя; вызывать из клика).
 */
export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionState> {
	if (typeof window === 'undefined' || !('Notification' in window)) {
		return 'denied';
	}
	const current = Notification.permission;
	if (current === 'granted' || current === 'denied') {
		return current;
	}
	try {
		return await Notification.requestPermission();
	} catch {
		return 'denied';
	}
}

/**
 * Показать системное уведомление, если ОС/браузер разрешили и вкладка в фоне.
 */
export function showBrowserNotificationWhenTabHidden(
	title: string,
	body: string,
	options?: UgsBrowserNotificationOptions
): void {
	if (typeof window === 'undefined' || !('Notification' in window)) {
		return;
	}
	if (Notification.permission !== 'granted') {
		return;
	}
	if (!isBrowserUnfocused()) {
		return;
	}
	try {
		const n = new Notification(title, {
			body,
			tag: options?.tag ?? 'eliteew-ugs',
		});
		if (options?.onClick) {
			n.onclick = () => {
				try {
					window.focus();
				} catch {
					// ignore
				}
				try {
					options.onClick?.();
				} finally {
					n.close();
				}
			};
		}
	} catch {
		// Safari / политики — тихо пропускаем
	}
}
