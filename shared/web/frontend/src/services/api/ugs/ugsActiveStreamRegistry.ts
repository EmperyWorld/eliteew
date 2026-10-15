/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Track open UGS SSE generation streams so dashboard polling can back off while
 * progress is pushed over the stream.
 *
 * Invariants:
 * - Counter is process-wide (single tab); useSyncExternalStore subscribers get updates.
 *
 * Related:
 * - hooks/api/useUgsDashboard.ts
 * - services/api/ugs/runUgsGenerationStream.ts
 */

const listeners = new Set<() => void>();
let activeStreamCount = 0;

function notify(): void {
	for (const listener of listeners) {
		listener();
	}
}

export function subscribeUgsActiveStreams(
	onStoreChange: () => void
): () => void {
	listeners.add(onStoreChange);
	return () => {
		listeners.delete(onStoreChange);
	};
}

export function getUgsActiveStreamCount(): number {
	return activeStreamCount;
}

export function beginUgsActiveStream(): void {
	activeStreamCount += 1;
	notify();
}

export function endUgsActiveStream(): void {
	activeStreamCount = Math.max(0, activeStreamCount - 1);
	notify();
}
