/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Coalesce Desktop AI Chat SSE token paints to one UI write per animation frame.
 *
 * Invariants:
 * - schedule replaces the pending flush; flushNow runs at most the latest pending work.
 * - cancel drops pending work without running it.
 *
 * Related:
 * - hooks/useDesktopAiChatStream.ts
 */

export type DesktopAiChatTokenBatch = {
	schedule: (flush: () => void) => void;
	flushNow: () => void;
	cancel: () => void;
};

function clearHandle(
	rafId: number | null,
	timeoutId: ReturnType<typeof setTimeout> | null
): void {
	if (rafId != null && typeof cancelAnimationFrame === 'function') {
		cancelAnimationFrame(rafId);
	}
	if (timeoutId != null) {
		clearTimeout(timeoutId);
	}
}

/**
 * Create a one-pending-callback coalescer keyed to rAF (setTimeout(0) fallback).
 */
export function createDesktopAiChatTokenBatch(): DesktopAiChatTokenBatch {
	let rafId: number | null = null;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let pending: (() => void) | null = null;

	const clearSchedule = () => {
		clearHandle(rafId, timeoutId);
		rafId = null;
		timeoutId = null;
	};

	const runPending = () => {
		clearSchedule();
		const fn = pending;
		pending = null;
		fn?.();
	};

	return {
		schedule(flush) {
			pending = flush;
			if (rafId != null || timeoutId != null) {
				return;
			}
			if (typeof requestAnimationFrame === 'function') {
				rafId = requestAnimationFrame(() => {
					rafId = null;
					runPending();
				});
				return;
			}
			timeoutId = setTimeout(() => {
				timeoutId = null;
				runPending();
			}, 0);
		},
		flushNow() {
			runPending();
		},
		cancel() {
			clearSchedule();
			pending = null;
		},
	};
}
