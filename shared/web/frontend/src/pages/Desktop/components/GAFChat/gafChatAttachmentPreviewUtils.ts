/**
 * Shared classification and formatting for GAF chat file attachments (thread + composer).
 */

export type GafAttachmentPreviewKind =
	| 'image'
	| 'pdf'
	| 'video'
	| 'audio'
	| 'archive'
	| 'office'
	| 'sticker'
	| 'text'
	| 'other';

const AUDIO_FILE_EXT_RE =
	/\.(mp3|m4a|aac|wav|flac|ogg|opus|oga|aif|aiff|wma)$/i;

const VIDEO_FILE_EXT_RE = /\.(mp4|mov|mkv|avi|m4v|webm)$/i;

const OFFICE_EXT_RE = /\.(doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|rtf|csv)$/i;

const ARCHIVE_EXT_RE =
	/\.(zip|rar|7z|tar|gz|tgz|bz2|xz|cab|lzma|zst|tar\.gz)$/i;

/** Markdown, логи, код, plain text — предпросмотр как текст в чате. */
const TEXT_FILE_EXT_RE =
	/\.(md|mdx|txt|log|json|ts|tsx|js|jsx|mjs|cjs|css|scss|less|vue|svelte|yaml|yml|toml|ini|conf|cfg|env|sh|bash|zsh|bat|ps1|sql|graphql|rs|go|py|rb|php|java|kt|swift|cs|cpp|h|hpp|mm)$/i;

function isTextLikeMime(m: string): boolean {
	const low = m.toLowerCase();
	if (low.startsWith('text/')) return true;
	if (
		low === 'application/json' ||
		low === 'application/xml' ||
		low === 'application/javascript' ||
		low === 'application/x-yaml' ||
		low === 'text/yaml'
	) {
		return true;
	}
	return false;
}

function isOfficeMime(m: string): boolean {
	if (m.startsWith('application/vnd.openxmlformats-officedocument'))
		return true;
	if (m.startsWith('application/vnd.oasis.opendocument')) return true;
	if (m === 'application/rtf' || m === 'text/rtf' || m === 'text/csv')
		return true;
	if (/^application\/vnd\.ms-/.test(m)) return true;
	if (m === 'application/msword') return true;
	return false;
}

function isArchiveMime(m: string): boolean {
	if (
		/^application\/(zip|x-zip-compressed|x-rar-compressed|x-7z-compressed)/.test(
			m
		)
	)
		return true;
	if (
		m === 'application/x-tar' ||
		m === 'application/gzip' ||
		m === 'application/x-gzip'
	)
		return true;
	if (m === 'application/x-bzip2' || m === 'application/x-xz') return true;
	return false;
}

const STICKER_MAX_BYTES = 512 * 1024;

export function formatGafBytes(n: number | null | undefined): string {
	if (n == null || n < 0) return '';
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function looksLikeSticker(
	mime: string,
	baseName: string,
	sizeBytes: number | null | undefined
): boolean {
	const m = mime.toLowerCase();
	if (!m.startsWith('image/')) return false;
	if (/sticker|стикер/i.test(baseName)) return true;
	if (
		m === 'image/webp' ||
		m === 'image/gif' ||
		/\.(webp|gif)$/i.test(baseName)
	) {
		if (sizeBytes == null) return false;
		return sizeBytes > 0 && sizeBytes <= STICKER_MAX_BYTES;
	}
	return false;
}

/**
 * Classifies attachment for preview UI (badges, thumbnail vs icon, modal type).
 */
export function previewKind(
	mime: string | null | undefined,
	name: string | undefined,
	sizeBytes?: number | null
): GafAttachmentPreviewKind {
	const m = (mime || '').toLowerCase();
	const base = (name || '').toLowerCase();

	if (looksLikeSticker(m, base, sizeBytes)) return 'sticker';
	if (m.startsWith('image/')) return 'image';
	if (m.includes('pdf') || base.endsWith('.pdf')) return 'pdf';
	if (m.startsWith('audio/')) return 'audio';
	if (AUDIO_FILE_EXT_RE.test(base)) return 'audio';
	if (m.startsWith('video/')) return 'video';
	if (VIDEO_FILE_EXT_RE.test(base)) return 'video';
	if (OFFICE_EXT_RE.test(base) || isOfficeMime(m)) return 'office';
	if (ARCHIVE_EXT_RE.test(base) || isArchiveMime(m)) return 'archive';
	if (TEXT_FILE_EXT_RE.test(base) || isTextLikeMime(m)) return 'text';
	return 'other';
}

/** Hint MIME for Blob when server returns octet-stream (inline audio player). */
export { audioMimeHintForFile } from '@/services/audio/normalizeAudioBlob';
