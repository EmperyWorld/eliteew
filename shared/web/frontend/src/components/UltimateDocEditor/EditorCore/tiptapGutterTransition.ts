/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Gutter layout transition phases and guards — prevent scroll/resize races during boot.
 *
 * Invariants:
 * - Stable gutter height never decreases while boot/viewport; full phase converges exactly to content height.
 * - Scroll/resize promotions are deferred during `boot` and coalesced afterward.
 *
 * Related:
 * - TiptapEditor.tsx
 * - tiptapGutterLayoutScheduling.ts
 */

export type GutterLayoutPhase = 'boot' | 'viewport' | 'full';

export interface GutterTransitionState {
	phase: GutterLayoutPhase;
	stableHeightPx: number;
	pendingFullLayout: boolean;
}

export function createGutterTransitionState(): GutterTransitionState {
	return {
		phase: 'boot',
		stableHeightPx: 0,
		pendingFullLayout: false,
	};
}

export function resolveStableGutterHeight(
	scrollHeightPx: number,
	minHeightPx = 500
): number {
	return Math.max(scrollHeightPx, minHeightPx);
}

export function applyStableGutterHeight(
	state: GutterTransitionState,
	nextScrollHeightPx: number,
	minHeightPx = 500
): number {
	const next = resolveStableGutterHeight(nextScrollHeightPx, minHeightPx);
	state.stableHeightPx = Math.max(state.stableHeightPx, next);
	return state.stableHeightPx;
}

/**
 * Monotonic during boot/viewport; exact convergence to content height on full phase.
 * Prevents over-expansion ghost layout after full layout completes.
 */
export function resolveGutterHeightForPhase(
	state: GutterTransitionState,
	scrollHeightPx: number,
	phase: GutterLayoutPhase,
	minHeightPx = 500
): number {
	const target = resolveStableGutterHeight(scrollHeightPx, minHeightPx);
	if (phase === 'full') {
		state.stableHeightPx = target;
		return target;
	}
	state.stableHeightPx = Math.max(state.stableHeightPx, target);
	return state.stableHeightPx;
}

export function resolveScheduledGutterScope(
	phase: GutterLayoutPhase
): 'full' | 'viewport' {
	return phase === 'full' ? 'full' : 'viewport';
}

export function markGutterViewportReady(state: GutterTransitionState): boolean {
	state.phase = 'viewport';
	return state.pendingFullLayout;
}

export function markGutterFullReady(state: GutterTransitionState): void {
	state.phase = 'full';
	state.pendingFullLayout = false;
}

/** Scroll/resize during boot — queue full layout instead of applying jittery reads. */
export function deferScrollResizePromotion(
	state: GutterTransitionState
): boolean {
	if (state.phase !== 'boot') {
		return false;
	}
	state.pendingFullLayout = true;
	return true;
}

/** Returns false when promotion must wait for the boot viewport pass. */
export function requestGutterFullLayoutPromotion(
	state: GutterTransitionState
): boolean {
	if (state.phase === 'boot') {
		state.pendingFullLayout = true;
		return false;
	}
	return true;
}

export function consumePendingFullLayout(
	state: GutterTransitionState
): boolean {
	if (!state.pendingFullLayout) {
		return false;
	}
	state.pendingFullLayout = false;
	return true;
}
