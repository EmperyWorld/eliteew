/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build desktop orchestration observations from persisted shell-state (`GET /api/v1/desktop/shell-state`) for EWA platform UI.
 *
 * Invariants:
 * - Wire shapes match `OBSERVATION-CATALOG.md` (`window_list_snapshot`, `active_app_changed`).
 * - Window ids align server-side heuristics in `eliteew_shell_domain_hints_http.py` (`path` joined by `/`).
 *
 * Related:
 * - src/features/ewa/EwaDesktopView.tsx
 * - src/features/ewa/companionObservationConstants.ts (debounce constants for companion anticipation live in hook)
 * - shared/api/ewa_platform/docs/OBSERVATION-CATALOG.md
 */
import type { DesktopShellState } from '@/pages/Desktop/services/desktopApi';
import type { PersistedWindowState } from '@/pages/Desktop/types/desktop.types';
import { getWindowsArrayFromShellSnapshot } from '@/pages/Desktop/utils/desktopWindowsSnapshot';

export function windowRefFromPersistedWindow(
	w: PersistedWindowState,
	idx: number
): string {
	if (w.path?.length) {
		return w.path.join('/');
	}
	const ac = w.appComponent?.trim();
	if (ac) {
		return `app:${ac}:${idx}`;
	}
	return `window:${idx}`;
}

/** Observation matching `window_list_snapshot` from open windows in shell-state. */
export function buildWindowListObservationFromShellState(
	shell: DesktopShellState
): Record<string, unknown> {
	const windows = getWindowsArrayFromShellSnapshot(shell.windows_snapshot);
	const slim = windows.map((w, idx) => ({
		window_id: windowRefFromPersistedWindow(w, idx),
		app_component: w.appComponent ?? null,
		title: w.title ?? '',
		type: w.type,
	}));
	return { observation_kind: 'window_list_snapshot', windows: slim };
}

/**
 * Best-effort focused app observation using highest `zIndex` among non-minimized app windows.
 * Returns `null` when no candidate exists.
 */
export function buildActiveAppObservationFromShellState(
	shell: DesktopShellState
): Record<string, unknown> | null {
	const all = getWindowsArrayFromShellSnapshot(shell.windows_snapshot);
	const candidates = all.filter((w) => w.type === 'app' && !w.isMinimized);
	if (!candidates.length) {
		return null;
	}
	const top = [...candidates].sort(
		(a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0)
	)[0];
	const idx = Math.max(0, all.indexOf(top));
	const wid = windowRefFromPersistedWindow(top, idx);
	const ac = top.appComponent?.trim();
	if (!ac || !wid.trim()) {
		return null;
	}
	return {
		observation_kind: 'active_app_changed',
		app_component: ac,
		window_id: wid,
	};
}
