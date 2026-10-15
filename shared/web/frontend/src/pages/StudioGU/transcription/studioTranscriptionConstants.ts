/** Shared constants for long-form transcription (Whisper async) inside Studio GU. */

export const TRANSCRIPTION_HISTORY_STORAGE_KEY = 'transcriptionHistory';
export const TRANSCRIPTION_RESTORE_JOB_KEY = 'audio-transcription-active-job';
export const STUDIO_GU_INITIAL_MODE_KEY = 'eliteew.studioGu.initialMode';

export const SUPPORTED_FORMATS =
	'.mp3,.wav,.m4a,.flac,.ogg,.aac,.wma,.webm,.mp4,.avi,.mov,.mkv';

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [
	'mp3',
	'wav',
	'm4a',
	'flac',
	'ogg',
	'aac',
	'webm',
	'mp4',
	'm4v',
	'avi',
	'mov',
	'mkv',
	'wma',
] as const;

export const LANGUAGES: { value: string; label: string }[] = [
	{ value: 'auto', label: 'Авто-определение' },
	{ value: 'ru', label: 'Русский' },
	{ value: 'en', label: 'English' },
	{ value: 'de', label: 'Deutsch' },
	{ value: 'fr', label: 'Français' },
	{ value: 'es', label: 'Español' },
	{ value: 'it', label: 'Italiano' },
	{ value: 'pt', label: 'Português' },
	{ value: 'zh', label: '中文' },
	{ value: 'ja', label: '日本語' },
	{ value: 'ko', label: '한국어' },
	{ value: 'uk', label: 'Українська' },
	{ value: 'pl', label: 'Polski' },
];

export const MODELS: { value: string; label: string; desc: string }[] = [
	{
		value: 'large-v3',
		label: 'Large V3',
		desc: 'Канон prod STT (read-only; веса в stack9)',
	},
];

export function getFileExtension(name: string): string {
	const idx = name.lastIndexOf('.');
	return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

export function validateAudioFile(file: File): string | null {
	if (file.size > MAX_FILE_SIZE_BYTES) {
		return `Файл слишком большой (макс. ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))} МБ).`;
	}
	const ext = getFileExtension(file.name);
	if (
		!ext ||
		!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])
	) {
		return `Поддерживаемые форматы: ${SUPPORTED_FORMATS}`;
	}
	return null;
}
