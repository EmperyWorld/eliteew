/**
 * Публичная подпись канала UGS: БД display_label или fallback по типу движка (без сырого имени в UI).
 */

const TYPE_FALLBACK: Record<string, string> = {
	llama: 'Текст',
	openai: 'Текст',
	anthropic: 'Текст',
	groq: 'Текст',
	comfyui: 'Медиа',
	stable_diffusion: 'Медиа',
	sdxl: 'Медиа',
	faster_whisper: 'Аудио',
	whisper: 'Аудио',
	tts: 'Аудио',
	silero: 'Аудио',
	ffmpeg: 'Видео',
	video: 'Видео',
};

export function fallbackLabelFromProviderType(
	providerType: string | undefined | null
): string {
	if (!providerType) return 'Сервис';
	const k = providerType.toLowerCase().trim();
	return TYPE_FALLBACK[k] ?? 'Сервис';
}

export function ugsProviderDisplayLabel(
	displayLabel: string | null | undefined,
	providerType: string | undefined | null,
	providerName?: string | null
): string {
	const trimmed = typeof displayLabel === 'string' ? displayLabel.trim() : '';
	if (trimmed) return trimmed;
	return fallbackLabelFromProviderType(
		providerType ?? providerName ?? undefined
	);
}
