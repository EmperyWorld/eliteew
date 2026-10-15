/**
 * Черновики текста композера GAF Chat (localStorage, без сервера).
 * Ключ: пользователь + chat_id — при смене диалога текст не теряется.
 */

const STORAGE_PREFIX = 'eliteew.gafChat.composerDraft.v1::';
const MAX_LEN = 4000;

function key(userId: string, chatId: string): string {
	return `${STORAGE_PREFIX}${userId}::${chatId}`;
}

export function loadGafComposerDraft(userId: string, chatId: string): string {
	try {
		const raw = window.localStorage.getItem(key(userId, chatId));
		if (raw == null || typeof raw !== 'string') return '';
		return raw.slice(0, MAX_LEN);
	} catch {
		return '';
	}
}

export function saveGafComposerDraft(
	userId: string,
	chatId: string,
	text: string
): void {
	try {
		const t = text.slice(0, MAX_LEN);
		if (!t.trim()) {
			window.localStorage.removeItem(key(userId, chatId));
			return;
		}
		window.localStorage.setItem(key(userId, chatId), t);
	} catch {
		/* quota / private mode */
	}
}

export function clearGafComposerDraft(userId: string, chatId: string): void {
	try {
		window.localStorage.removeItem(key(userId, chatId));
	} catch {
		/* ignore */
	}
}
