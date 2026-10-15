/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Emit redacted Continuity W0 refresh diagnostic events via the SPA logger.
 *
 * Invariants:
 * - Payload must never include bearer tokens, codes, or cookies.
 * - Logger redaction is a second line of defence, not the primary contract.
 *
 * Related:
 * - `webSsoRefreshResult.ts`, `utils/logger.ts`
 */

import { log } from '../../utils/logger';
import type { WebSsoRefreshContinuityEvent } from './webSsoRefreshResult';

const COMPONENT = 'WebSsoRefreshContinuity';

export function emitWebSsoRefreshContinuityEvent(
	event: WebSsoRefreshContinuityEvent
): void {
	const payload = {
		phase: event.phase,
		correlationId: event.correlationId,
		kind: event.kind,
		oauthError: event.oauthError,
		oauthErrorDescription: event.oauthErrorDescription,
		httpStatus: event.httpStatus,
	};
	if (event.phase === 'start') {
		log.info(COMPONENT, 'browser_oidc_refresh_start', payload);
		return;
	}
	if (event.kind === 'refreshed') {
		log.info(COMPONENT, 'browser_oidc_refresh_result', payload);
		return;
	}
	if (event.kind === 'network') {
		log.warn(COMPONENT, 'browser_oidc_refresh_result', payload);
		return;
	}
	log.error(COMPONENT, 'browser_oidc_refresh_result', undefined, payload);
}
