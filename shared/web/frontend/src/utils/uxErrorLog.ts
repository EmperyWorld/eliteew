/**
 * UX error logging for observability.
 * Logs user-facing errors with scenario and operation.
 */

import { log } from './logger';

/** Known UX scenarios (PageType or flow name) for error context. */
export type UxScenario =
	| 'auth'
	| 'desktop'
	| 'unified_content'
	| 'voice_studio'
	| 'live_voice'
	| 'audio_transcription'
	| 'arly_chat'
	| 'admin'
	| 'unknown';

/**
 * Log a UX-relevant error with scenario/operation.
 * Use for auth failures, voice pipeline errors, file operations, etc.
 */
export function logUxError(
	scenario: UxScenario,
	operation: string,
	error: unknown,
	extra?: Record<string, unknown>
): void {
	const message = error instanceof Error ? error.message : String(error);
	log.error('[UX Error]', `${scenario}:${operation} - ${message}`, undefined, {
		scenario,
		operation,
		...extra,
	});
}
