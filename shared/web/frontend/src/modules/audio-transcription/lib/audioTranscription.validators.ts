import {
	MAX_FILE_SIZE_BYTES,
	SUPPORTED_AUDIO_EXTENSIONS,
} from './audioTranscription.constants';

export interface FileValidationResult {
	readonly valid: boolean;
	readonly error?: string;
	readonly warnings?: readonly string[];
}

export function validateAudioFile(file: File): FileValidationResult {
	const extension = file.name.split('.').pop()?.toLowerCase();
	const warnings: string[] = [];

	if (!extension || !SUPPORTED_AUDIO_EXTENSIONS.includes(extension)) {
		return {
			valid: false,
			error: `Неподдерживаемый формат файла. Поддерживаемые форматы: ${SUPPORTED_AUDIO_EXTENSIONS.join(', ')}`,
		};
	}

	if (file.size > MAX_FILE_SIZE_BYTES) {
		return {
			valid: false,
			error: `Размер файла превышает лимит в ${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB`,
		};
	}

	if (file.size > 50 * 1024 * 1024) {
		warnings.push('Файл больше 50MB - обработка может занять время');
	}

	if (file.size < 1024 * 1024) {
		warnings.push('Файл меньше 1MB - качество транскрибации может быть низким');
	}

	return {
		valid: true,
		warnings: warnings.length > 0 ? warnings : undefined,
	};
}
