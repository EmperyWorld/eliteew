/** Caps multi-file handbook KB upload to server `max_files` (see GET upload-limits). */
export function capAssistantKbUploadFiles(
	files: File[],
	maxFiles: number
): { accepted: File[]; dropped: number } {
	const cap = Math.max(1, Math.floor(maxFiles));
	if (files.length <= cap) {
		return { accepted: files, dropped: 0 };
	}
	return { accepted: files.slice(0, cap), dropped: files.length - cap };
}
