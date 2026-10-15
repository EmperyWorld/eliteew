export const SUPPORTED_AUDIO_EXTENSIONS: readonly string[] = [
	'mp3',
	'wav',
	'm4a',
	'flac',
	'ogg',
	'aac',
	'wma',
	'mp4',
	'avi',
	'mov',
	'mkv',
];

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

export interface SelectOption {
	readonly value: string;
	readonly label: string;
}

export const LANGUAGE_OPTIONS: readonly SelectOption[] = [
	{ value: 'auto', label: 'Автоопределение' },
	{ value: 'en', label: 'English' },
	{ value: 'ru', label: 'Русский' },
	{ value: 'uk', label: 'Українська' },
	{ value: 'de', label: 'Deutsch' },
	{ value: 'fr', label: 'Français' },
	{ value: 'es', label: 'Español' },
];

export const WHISPER_MODELS: readonly SelectOption[] = [
	{ value: 'large-v3', label: 'Whisper Large V3 (качество)' },
	{ value: 'turbo', label: 'Whisper Turbo (быстро)' },
	{ value: 'base', label: 'Whisper Base' },
	{ value: 'small', label: 'Whisper Small' },
	{ value: 'medium', label: 'Whisper Medium' },
	{ value: 'large', label: 'Whisper Large' },
];
