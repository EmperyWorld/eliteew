/**
 * Per-thread UI preferences for the current user (localStorage).
 * Key: viewer user id + chat id — «мои» настройки в этом диалоге.
 */
export type GafChatThreadPrefs = {
	/** Загружать blob'ы для превью изображений/видео/аудио. */
	loadMedia: boolean;
	/** Показывать inline-превью медиа в пузырях (если loadMedia false — только полоска файла). */
	showMediaPreview: boolean;
};

const DEFAULT_PREFS: GafChatThreadPrefs = {
	/** По умолчанию показываем inline-превью и подгружаем blob'ы (можно отключить в настройках чата). */
	loadMedia: true,
	showMediaPreview: true,
};

const STORAGE_PREFIX = 'eliteew.gafChat.threadPrefs.v1::';

function key(userId: string, chatId: string): string {
	return `${STORAGE_PREFIX}${userId}::${chatId}`;
}

export function loadGafChatThreadPrefs(
	userId: string | null,
	chatId: string | null
): GafChatThreadPrefs {
	if (!userId || !chatId) return { ...DEFAULT_PREFS };
	try {
		const raw = window.localStorage.getItem(key(userId, chatId));
		if (!raw) return { ...DEFAULT_PREFS };
		const parsed = JSON.parse(raw) as Partial<GafChatThreadPrefs>;
		return {
			loadMedia:
				typeof parsed.loadMedia === 'boolean'
					? parsed.loadMedia
					: DEFAULT_PREFS.loadMedia,
			showMediaPreview:
				typeof parsed.showMediaPreview === 'boolean'
					? parsed.showMediaPreview
					: DEFAULT_PREFS.showMediaPreview,
		};
	} catch {
		return { ...DEFAULT_PREFS };
	}
}

export function saveGafChatThreadPrefs(
	userId: string,
	chatId: string,
	prefs: GafChatThreadPrefs
): void {
	try {
		window.localStorage.setItem(key(userId, chatId), JSON.stringify(prefs));
	} catch {
		/* ignore */
	}
}
