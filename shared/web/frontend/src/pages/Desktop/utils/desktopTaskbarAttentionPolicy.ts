/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure attention policy for taskbar secondary chips that prefer «Ещё» until an event.
 * Mirrors session warning/critical rail promotion.
 *
 * Invariants:
 * - Panel-open always counts as attention so the user can dismiss from the rail chip.
 * - Clipboard rail pulse is time-bounded from newest history timestamp.
 * - Volume glyph levels are derived only from clamped 0…1 volume.
 *
 * Related:
 * - components/TaskbarRightToolbar.tsx
 * - components/TaskbarSecondaryOverflow.tsx
 * - utils/desktopTraySurfacePolicy.ts
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

/** How long a fresh clipboard capture keeps the clipboard chip on the primary rail. */
export const CLIPBOARD_RAIL_ATTENTION_MS = 90_000;

export function clipboardNeedsRailAttention(input: {
	newestTimestamp: Date | string | null | undefined;
	nowMs?: number;
	/** Clipboard window/panel open — keep chip visible while in use. */
	panelOpen?: boolean;
}): boolean {
	if (input.panelOpen) return true;
	const raw = input.newestTimestamp;
	if (raw == null) return false;
	const ms =
		raw instanceof Date
			? raw.getTime()
			: typeof raw === 'string'
				? Date.parse(raw)
				: Number.NaN;
	if (!Number.isFinite(ms)) return false;
	const now = input.nowMs ?? Date.now();
	return now - ms <= CLIPBOARD_RAIL_ATTENTION_MS;
}

export function notificationsNeedRailAttention(input: {
	unreadCount: number;
	panelOpen: boolean;
}): boolean {
	return input.panelOpen || input.unreadCount > 0;
}

export function backgroundTrayNeedsRailAttention(input: {
	gafUnread: number;
	friendsIncomingCount: number;
	ugsActiveTaskCount: number;
	musicPlaybackError: boolean;
	ugsTrayPollError: boolean;
	panelOpen: boolean;
}): boolean {
	if (input.panelOpen) return true;
	if (input.gafUnread > 0) return true;
	if (input.friendsIncomingCount > 0) return true;
	if (input.ugsActiveTaskCount > 0) return true;
	if (input.musicPlaybackError) return true;
	if (input.ugsTrayPollError) return true;
	return false;
}

export type TaskbarVolumeGlyphLevel = 'muted' | 'low' | 'medium' | 'high';

export function resolveTaskbarVolumeGlyphLevel(
	volume: number
): TaskbarVolumeGlyphLevel {
	const v = Math.max(0, Math.min(1, volume));
	if (v <= 0.001) return 'muted';
	if (v < 0.34) return 'low';
	if (v < 0.67) return 'medium';
	return 'high';
}

export function newestClipboardTimestamp(
	history: ReadonlyArray<{ timestamp: Date | string }>
): Date | string | null {
	if (history.length === 0) return null;
	let best: Date | string | null = null;
	let bestMs = Number.NEGATIVE_INFINITY;
	for (const item of history) {
		const raw = item.timestamp;
		const ms =
			raw instanceof Date
				? raw.getTime()
				: typeof raw === 'string'
					? Date.parse(raw)
					: Number.NaN;
		if (!Number.isFinite(ms)) continue;
		if (ms >= bestMs) {
			bestMs = ms;
			best = raw;
		}
	}
	return best;
}
