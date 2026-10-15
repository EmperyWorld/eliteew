import { log } from '@utils/logger';
import { notifyDesktopClipboardCapture } from '@/pages/Desktop/utils/desktopClipboardCaptureBus';

/**
 * 🔐 SAFE CLIPBOARD UTILITIES
 *
 * Безопасные утилиты для работы с буфером обмена
 * с fallback для случаев, когда Clipboard API недоступен
 */

/**
 * Безопасное копирование текста в буфер обмена
 * @param text - Текст для копирования
 * @returns Promise<boolean> - true если успешно, false если ошибка
 */
export async function safeCopyToClipboard(text: string): Promise<boolean> {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			notifyDesktopClipboardCapture({ type: 'text', content: text, source: 'app' });
			return true;
		} catch (err) {
			log.warn('Clipboard', 'Clipboard API failed, trying fallback', err);
			return fallbackCopyToClipboard(text);
		}
	}
	return fallbackCopyToClipboard(text);
}

/**
 * Fallback метод копирования через создание временного textarea
 * Работает даже когда Clipboard API недоступен
 */
function fallbackCopyToClipboard(text: string): boolean {
	try {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-999999px';
		textArea.style.top = '-999999px';
		textArea.style.opacity = '0';
		textArea.style.pointerEvents = 'none';

		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		const successful = document.execCommand('copy');
		document.body.removeChild(textArea);

		if (successful) {
			notifyDesktopClipboardCapture({ type: 'text', content: text, source: 'app' });
		}
		return successful;
	} catch (err) {
		log.error(
			'Clipboard',
			'Fallback copy failed',
			err instanceof Error ? err : undefined,
			{ raw: err }
		);
		return false;
	}
}

/**
 * Проверка доступности Clipboard API
 */
export function isClipboardAvailable(): boolean {
	return !!navigator.clipboard?.writeText;
}
