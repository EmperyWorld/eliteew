/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map raw AI stream / mic errors to safe user-facing docEditorPanels strings.
 *
 * Invariants:
 * - Never surface long stack traces or Internal Server Error bodies to the UI.
 *
 * Related:
 * - useAIAssistantChat.ts, useAIAssistantVoice.ts
 */

import type { TFunction } from 'i18next';

export function mapAiErrorForUser(
	error: unknown,
	t: TFunction<'docEditorPanels'>
): string {
	if (!(error instanceof Error)) {
		return t('ai.errors.generic');
	}
	const raw = error.message.trim();
	const lower = raw.toLowerCase();
	if (lower.includes('abort')) {
		return t('ai.errors.aborted');
	}
	if (
		lower.includes('failed to fetch') ||
		lower.includes('network') ||
		lower.includes('load failed')
	) {
		return t('ai.errors.network');
	}
	if (
		lower.includes('404') ||
		lower.includes('not available') ||
		lower.includes('endpoint not available')
	) {
		return t('ai.errors.unavailable');
	}
	if (lower.includes('timeout')) {
		return t('ai.errors.timeout');
	}
	if (
		raw.length > 160 ||
		/Traceback|File "|Internal Server Error|\b500\b/i.test(raw)
	) {
		return t('ai.errors.generic');
	}
	return raw;
}

export function mapMicAccessError(
	err: unknown,
	t: TFunction<'docEditorPanels'>
): string {
	if (err && typeof err === 'object' && 'name' in err) {
		const name = String((err as DOMException).name);
		if (name === 'NotAllowedError') {
			return t('ai.voiceErrors.micDenied');
		}
		if (name === 'NotFoundError') {
			return t('ai.voiceErrors.micNotFound');
		}
		if (name === 'NotReadableError' || name === 'AbortError') {
			return t('ai.voiceErrors.micBusy');
		}
	}
	if (
		err instanceof Error &&
		err.message.length < 120 &&
		!/Traceback|File "/i.test(err.message)
	) {
		return err.message;
	}
	return t('ai.voiceErrors.transcribeFailed');
}
