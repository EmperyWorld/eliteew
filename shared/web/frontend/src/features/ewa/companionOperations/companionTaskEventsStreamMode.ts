/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Choose global vs per-run companion task SSE transport (Phase 5.5 reconnect).
 *
 * Invariants:
 * - Exactly one active run → scoped ``/task-runs/{id}/events`` with ``run_snapshot`` on connect.
 * - Zero or multiple active runs → principal-wide ``/task-events/stream``.
 *
 * Related:
 * - src/features/ewa/companionOperations/useCompanionTaskEventsStream.ts
 */

/** SSE mode for background operation lifecycle updates. */
export type CompanionTaskEventsStreamMode = 'global' | 'per_run';

export function companionTaskEventsStreamMode(
	activeRunIds: readonly string[]
): { mode: CompanionTaskEventsStreamMode; runId: string | null } {
	const ids = activeRunIds.map((id) => id.trim()).filter(Boolean);
	if (ids.length === 1) {
		return { mode: 'per_run', runId: ids[0] ?? null };
	}
	return { mode: 'global', runId: null };
}
