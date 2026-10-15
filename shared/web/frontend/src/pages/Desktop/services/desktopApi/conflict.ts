/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop shell_state optimistic concurrency conflict error and type guards.
 *
 * Invariants:
 * - **412** responses map to {@link DesktopShellStateConflictError} (no silent retry in API layer).
 *
 * Related:
 * - `services/desktopApi/shellState.ts`
 * - `utils/desktopShellStateMutationPipeline.ts`
 */

import { SHELL_STATE_CONFLICT_MESSAGE } from './constants';

export class DesktopShellStateConflictError extends Error {
	constructor(
		message = SHELL_STATE_CONFLICT_MESSAGE,
		public readonly currentEtag?: string | null,
		public readonly serverDetail?: Record<string, unknown> | null
	) {
		super(message);
		this.name = 'DesktopShellStateConflictError';
		Object.setPrototypeOf(this, DesktopShellStateConflictError.prototype);
	}
}

export function isDesktopShellStateConflictError(
	error: unknown
): error is DesktopShellStateConflictError {
	return error instanceof DesktopShellStateConflictError;
}

export function isDesktopShellStateConflictMessage(
	message: string | null | undefined
): boolean {
	if (!message) return false;
	return message.includes(SHELL_STATE_CONFLICT_MESSAGE);
}
