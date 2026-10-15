/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Post-paint gutter layout orchestration via requestAnimationFrame (no idle placeholder gap).
 *
 * Invariants:
 * - Initial viewport refinement uses double-rAF, not requestIdleCallback.
 * - Background full layout promotion is rAF-deferred after viewport is stable.
 *
 * Related:
 * - src/components/UltimateDocEditor/EditorCore/TiptapEditor.tsx
 */

export type GutterLayoutFrameHandle = number;

export function scheduleGutterPostPaintWork(
	runLayout: () => void
): GutterLayoutFrameHandle {
	if (typeof window === 'undefined') {
		return 0;
	}
	return window.requestAnimationFrame(() => {
		window.requestAnimationFrame(runLayout);
	});
}

export function scheduleGutterBackgroundFullLayout(
	runFullLayout: () => void
): GutterLayoutFrameHandle {
	return scheduleGutterPostPaintWork(runFullLayout);
}

export function cancelGutterLayoutFrame(
	handle: GutterLayoutFrameHandle | null
): void {
	if (handle == null || typeof window === 'undefined') {
		return;
	}
	window.cancelAnimationFrame(handle);
}

/** @deprecated Use scheduleGutterPostPaintWork — kept for test migration only */
export type LazyGutterLayoutHandle = GutterLayoutFrameHandle;

/** @deprecated */
export const GUTTER_INITIAL_LAZY_IDLE_TIMEOUT_MS = 800;
/** @deprecated */
export const GUTTER_INITIAL_LAZY_FALLBACK_MS = 400;

/** @deprecated Use scheduleGutterPostPaintWork */
export function scheduleLazyGutterInitialLayout(
	runLayout: () => void
): LazyGutterLayoutHandle {
	return scheduleGutterPostPaintWork(runLayout);
}

/** @deprecated Use cancelGutterLayoutFrame */
export function cancelLazyGutterInitialLayout(
	handle: LazyGutterLayoutHandle | null
): void {
	cancelGutterLayoutFrame(handle);
}
