/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Decide when agentic tree/trace panels should keep polling while a mission is live.
 *
 * Invariants:
 * - Terminal / unknown statuses do not poll (refreshToken still triggers a one-shot load).
 *
 * Related:
 * - AgenticTaskTreePanel.tsx
 * - AgenticExecutionTrace.tsx
 */

const ACTIVE_AGENTIC_OBSERVABILITY_STATUSES = new Set([
	'init',
	'planning',
	'replanning',
	'executing',
	'awaiting_human',
	'paused',
]);

/** Poll interval while session is non-terminal (ms). */
export const AGENTIC_OBSERVABILITY_POLL_MS = 4_000;

export function isAgenticObservabilitySessionActive(
	sessionStatus: string
): boolean {
	return ACTIVE_AGENTIC_OBSERVABILITY_STATUSES.has(
		sessionStatus.trim().toLowerCase()
	);
}
