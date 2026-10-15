/**
 * Stable left-border accent classes per desktop folder (Content Manager «Все файлы» / группировка по папке).
 */
const FOLDER_ACCENT_BORDER_CLASSES = [
	'border-l-teal-400/80',
	'border-l-sky-400/80',
	'border-l-violet-400/80',
	'border-l-amber-400/80',
	'border-l-rose-400/80',
	'border-l-cyan-400/80',
	'border-l-fuchsia-400/80',
	'border-l-lime-400/80',
	'border-l-indigo-400/80',
	'border-l-orange-400/80',
] as const;

const UNFILED_ACCENT = 'border-l-zinc-500/55';

/** Deterministic bucket0..palette-1 for non-empty folder ids. */
export function folderIdBucket(folderId: string): number {
	let h = 0;
	for (let i = 0; i < folderId.length; i++) {
		h = (h * 31 + folderId.charCodeAt(i)) | 0;
	}
	return Math.abs(h) % FOLDER_ACCENT_BORDER_CLASSES.length;
}

/** Tailwind classes for a4px left accent (use with `border-l-4` on the card/row). */
export function getFolderAccentBorderClass(folderId: string | null): string {
	if (folderId == null || folderId.trim() === '') {
		return UNFILED_ACCENT;
	}
	return (
		FOLDER_ACCENT_BORDER_CLASSES[folderIdBucket(folderId)] ?? UNFILED_ACCENT
	);
}
