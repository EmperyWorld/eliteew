/**
 * Overlay keys for Ultimate Doc Editor side panels / dialogs.
 * Kept in a small module so orchestrator imports stay stable.
 */
export const PANEL_KEYS = [
	'ai',
	'image',
	'collab',
	'search',
	'versions',
	'fileManager',
	'ocr',
	'import',
	'pdf',
	'table',
	'math',
	'comments',
	'templates',
	'charts',
] as const;

export type OverlayKey = (typeof PANEL_KEYS)[number];
