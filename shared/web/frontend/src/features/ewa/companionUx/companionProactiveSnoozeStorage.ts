/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Snooze proactive suggestions until end of local day (U6.2).
 */

const KEY_PREFIX = 'eliteew.companion.proactiveSnooze.v1:';

function endOfLocalDayMs(): number {
	const now = new Date();
	const end = new Date(now);
	end.setHours(23, 59, 59, 999);
	return end.getTime();
}

export function isProactiveSnoozedToday(principalId: string): boolean {
	if (typeof window === 'undefined' || !principalId.trim()) return false;
	try {
		const raw = window.localStorage.getItem(`${KEY_PREFIX}${principalId}`);
		if (!raw) return false;
		const until = Number(raw);
		return Number.isFinite(until) && Date.now() < until;
	} catch {
		return false;
	}
}

export function snoozeProactiveUntilEndOfDay(principalId: string): void {
	if (typeof window === 'undefined' || !principalId.trim()) return;
	try {
		window.localStorage.setItem(
			`${KEY_PREFIX}${principalId}`,
			String(endOfLocalDayMs())
		);
	} catch {
		/* best-effort */
	}
}
