/**
 * Имена вложений, записанных микрофоном в GAF Chat (см. useGafVoiceRecorder).
 * По префиксу в UI показывается «голосовое», а не обычный файл.
 */
export const GAF_VOICE_ATTACHMENT_NAME_PREFIX = 'gaf-voice-';

/** unified_content.sub_type — API скрывает такие файлы из списка Content Manager */
export const GAF_VOICE_CONTENT_SUBTYPE = 'gaf_chat_voice';

export function isGafVoiceAttachmentName(
	name: string | null | undefined
): boolean {
	const n = (name || '').toLowerCase();
	return n.startsWith(GAF_VOICE_ATTACHMENT_NAME_PREFIX.toLowerCase());
}

/** Расширение файла по MIME из MediaRecorder (webm / m4a / ogg). */
export function extensionForRecordedVoiceMime(mime: string): string {
	const m = mime.toLowerCase();
	if (m.includes('webm')) return 'webm';
	if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
	if (m.includes('ogg')) return 'ogg';
	return 'webm';
}
