/**
 * Multipart uploads must include a non-empty filename; Starlette/FastAPI reject missing names.
 * Android WebView often yields picked files with an empty `File.name` (content:// URIs).
 */

export function ensureUploadFilename(file: File): string {
	const trimmed = file.name?.trim();
	if (trimmed) return trimmed;
	const mime = file.type?.trim().toLowerCase() || '';
	const byMime: Record<string, string> = {
		'image/jpeg': 'upload.jpg',
		'image/jpg': 'upload.jpg',
		'image/png': 'upload.png',
		'image/webp': 'upload.webp',
		'image/gif': 'upload.gif',
		'application/pdf': 'upload.pdf',
	};
	const mapped = byMime[mime];
	if (mapped) return mapped;
	if (mime.startsWith('audio/')) {
		const sub = mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'audio';
		return `upload.${sub}`;
	}
	if (mime.startsWith('video/')) {
		const sub = mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'video';
		return `upload.${sub}`;
	}
	return 'upload';
}

/** Ensures `File.name` is non-empty so FormData / UI labels behave like desktop browsers. */
export function normalizeFileForMultipartUpload(file: File): File {
	if (file.name?.trim()) return file;
	const fallback = ensureUploadFilename(file);
	return new File([file], fallback, {
		type: file.type || 'application/octet-stream',
		lastModified: file.lastModified,
	});
}
