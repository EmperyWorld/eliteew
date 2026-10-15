/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Performance marks for zero-latency entry audit (DevTools Performance timeline).
 *
 * Invariants:
 * - Marks are best-effort; never throw when `performance` is unavailable.
 *
 * Related:
 * - `documentation/architecture/optimization_study_2026.md`
 */

const PREFIX = 'eliteew:boot';

export function markBootPerformance(label: string): void {
	if (
		typeof performance === 'undefined' ||
		typeof performance.mark !== 'function'
	) {
		return;
	}
	try {
		performance.mark(`${PREFIX}:${label}`);
	} catch {
		// ignore duplicate or quota errors
	}
}

export function measureBootPerformance(
	name: string,
	startLabel: string,
	endLabel: string
): void {
	if (
		typeof performance === 'undefined' ||
		typeof performance.measure !== 'function'
	) {
		return;
	}
	try {
		performance.measure(
			`${PREFIX}:${name}`,
			`${PREFIX}:${startLabel}`,
			`${PREFIX}:${endLabel}`
		);
	} catch {
		// ignore missing marks
	}
}

export function logBootPerformanceSummary(): void {
	if (
		typeof performance === 'undefined' ||
		typeof performance.getEntriesByType !== 'function'
	) {
		return;
	}
	const measures = performance
		.getEntriesByType('measure')
		.filter((entry) => entry.name.startsWith(`${PREFIX}:`));
	if (measures.length === 0) {
		return;
	}
	// eslint-disable-next-line no-console
	console.info(
		'[EliteEW boot]',
		Object.fromEntries(
			measures.map((entry) => [
				entry.name.replace(`${PREFIX}:`, ''),
				Math.round(entry.duration),
			])
		)
	);
}
