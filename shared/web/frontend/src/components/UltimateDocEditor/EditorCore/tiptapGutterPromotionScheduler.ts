/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Debounced gutter promotion scheduler — coalesces burst scroll/resize/type events.
 *
 * Invariants:
 * - At most one debounced promotion and one rAF callback pending at a time.
 *
 * Related:
 * - TiptapEditor.tsx
 * - tiptapGutterTransition.ts
 */

export interface GutterPromotionScheduler {
	requestPromotion(): void;
	flushPending(): number;
	pendingPromotionCount(): number;
	dispose(): void;
}

export function createGutterPromotionScheduler(
	onRunLayout: () => void,
	debounceMs = 200
): GutterPromotionScheduler {
	let timerId: number | null = null;
	let rafId: number | null = null;
	let promotionRequests = 0;
	let layoutRuns = 0;

	const dispose = (): void => {
		if (timerId !== null) {
			window.clearTimeout(timerId);
			timerId = null;
		}
		if (rafId !== null) {
			window.cancelAnimationFrame(rafId);
			rafId = null;
		}
	};

	return {
		requestPromotion(): void {
			promotionRequests += 1;
			if (timerId !== null) {
				window.clearTimeout(timerId);
			}
			timerId = window.setTimeout(() => {
				timerId = null;
				if (rafId !== null) {
					return;
				}
				rafId = window.requestAnimationFrame(() => {
					rafId = null;
					layoutRuns += 1;
					onRunLayout();
				});
			}, debounceMs);
		},
		flushPending(): number {
			dispose();
			if (layoutRuns === 0 && promotionRequests > 0) {
				layoutRuns += 1;
				onRunLayout();
			}
			return layoutRuns;
		},
		pendingPromotionCount(): number {
			return promotionRequests;
		},
		dispose,
	};
}

/** Stress budget: sync handler work for 100 burst events (ms). */
export const GUTTER_STRESS_SYNC_BUDGET_MS = 16;

/** Expected layout runs after coalesced burst + single flush. */
export const GUTTER_STRESS_COALESCED_LAYOUT_RUNS = 1;

export const GUTTER_STRESS_EVENT_COUNT = 100;

export const GUTTER_STRESS_BURST_WINDOW_MS = 50;
