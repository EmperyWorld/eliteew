/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read/merge admin form for Desktop AI Chat Memory Cells defaults keys.
 *
 * Invariants:
 * - Only `memory_cells_*` keys are written by merge; other defaults untouched.
 *
 * Related:
 * - api/services/desktop_chat/memory_cells_settings.py
 * - documentation/product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md
 */

export type DesktopAiChatMemoryCellsForm = {
	enabled: boolean;
	maxPerUser: number;
	maxMessages: number;
	maxChunks: number;
	retrievalTopK: number;
	minScore: number;
};

function readBool(
	defaults: Record<string, unknown>,
	key: string,
	fallback: boolean
): boolean {
	if (!(key in defaults)) return fallback;
	return Boolean(defaults[key]);
}

function readInt(
	defaults: Record<string, unknown>,
	key: string,
	fallback: number,
	lo: number,
	hi: number
): number {
	const raw = defaults[key];
	const n =
		typeof raw === 'number'
			? raw
			: typeof raw === 'string'
				? Number(raw)
				: Number.NaN;
	if (!Number.isFinite(n)) return fallback;
	return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

function readFloat(
	defaults: Record<string, unknown>,
	key: string,
	fallback: number,
	lo: number,
	hi: number
): number {
	const raw = defaults[key];
	const n =
		typeof raw === 'number'
			? raw
			: typeof raw === 'string'
				? Number(raw)
				: Number.NaN;
	if (!Number.isFinite(n)) return fallback;
	return Math.min(hi, Math.max(lo, n));
}

export function emptyMemoryCellsForm(): DesktopAiChatMemoryCellsForm {
	return {
		enabled: true,
		maxPerUser: 3,
		maxMessages: 400,
		maxChunks: 256,
		retrievalTopK: 8,
		minScore: 0.2,
	};
}

export function readMemoryCellsForm(
	defaults: Record<string, unknown>
): DesktopAiChatMemoryCellsForm {
	return {
		enabled: readBool(defaults, 'memory_cells_enabled', true),
		maxPerUser: readInt(defaults, 'memory_cells_max_per_user', 3, 1, 5),
		maxMessages: readInt(defaults, 'memory_cells_max_messages', 400, 20, 2000),
		maxChunks: readInt(defaults, 'memory_cells_max_chunks', 256, 16, 1024),
		retrievalTopK: readInt(defaults, 'memory_cells_retrieval_top_k', 8, 1, 32),
		minScore: readFloat(defaults, 'memory_cells_min_score', 0.2, 0, 1),
	};
}

export function mergeMemoryCellsForm(
	base: Record<string, unknown>,
	form: DesktopAiChatMemoryCellsForm
): Record<string, unknown> {
	return {
		...base,
		memory_cells_enabled: form.enabled,
		memory_cells_max_per_user: form.maxPerUser,
		memory_cells_max_messages: form.maxMessages,
		memory_cells_max_chunks: form.maxChunks,
		memory_cells_retrieval_top_k: form.retrievalTopK,
		memory_cells_min_score: form.minScore,
	};
}
