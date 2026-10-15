/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Continuity W3 terminal teardown orchestrator (classify → capsule flush →
 * session-ended / session-replaced pending). Never uses location.reload.
 *
 * Invariants:
 * - Network refresh failures must not mark session-ended or clear tokens.
 * - Session-ended ≠ session_replaced (separate pending keys in authRedirect).
 *
 * Related:
 * - `webSsoRefreshResult.ts`, `webSsoRecoveryCapsule.ts`, `authRedirect.ts`
 * - `documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md` §W3
 */

import { log } from '../../utils/logger';
import {
	markSessionEndedPending,
	markSessionReplacedPending,
} from '../../utils/authRedirect';
import {
	classifyWebSsoRefreshFailure,
	type WebSsoRefreshResultKind,
} from './webSsoRefreshResult';
import { flushWebSsoRecoveryCapsule } from './webSsoRecoveryCapsule';

const LOG = 'WebSsoTerminalTeardown';

export type TerminalTeardownClearSession = () => void;

/**
 * Classify refresh failure and either keep the session (network) or run
 * capsule flush + session-ended / session-replaced pending + local clear.
 */
export async function handleBrowserTerminalRefreshFailure(input: {
	error: unknown;
	clearSession: TerminalTeardownClearSession;
}): Promise<{
	action: 'kept' | 'session_ended' | 'session_replaced';
	kind: WebSsoRefreshResultKind;
	preserved: boolean;
}> {
	const classified = classifyWebSsoRefreshFailure({ error: input.error });
	const kind = classified.kind;

	if (kind === 'network') {
		log.warn(LOG, 'network refresh failure — keeping local session');
		return { action: 'kept', kind, preserved: false };
	}

	if (kind === 'session_replaced') {
		markSessionReplacedPending();
		input.clearSession();
		return { action: 'session_replaced', kind, preserved: false };
	}

	// idle_or_max_expired | reuse_detected — terminal but recoverable
	const flush = await flushWebSsoRecoveryCapsule(kind);
	markSessionEndedPending({
		kind,
		preserved: flush.preserved,
		preservedAt: new Date().toISOString(),
	});
	input.clearSession();
	log.info(LOG, `session ended kind=${kind} preserved=${flush.preserved}`);
	return {
		action: 'session_ended',
		kind,
		preserved: flush.preserved,
	};
}
