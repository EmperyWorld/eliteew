/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side TTL checks for ensemble semi-auto document confirmation banners.
 *
 * Invariants:
 * - Expired `asked` state must not block the composer.
 *
 * Related:
 * - api/services/desktop_chat_ensemble/doc_confirm_policy.py
 */

import type { DesktopAiMessage } from './api/desktopChatClient';

const DEFAULT_TTL_SECONDS = 3600;

export function resolveEnsembleDocConfirmTtlSeconds(
	defaults: Record<string, unknown> | undefined
): number {
	const raw = defaults?.desktop_ensemble_doc_confirm_ttl_seconds;
	if (typeof raw === 'number' && Number.isFinite(raw)) {
		return Math.max(60, Math.min(86_400, Math.trunc(raw)));
	}
	if (typeof raw === 'string' && raw.trim()) {
		const parsed = Number.parseInt(raw.trim(), 10);
		if (Number.isFinite(parsed)) {
			return Math.max(60, Math.min(86_400, parsed));
		}
	}
	return DEFAULT_TTL_SECONDS;
}

function parseIsoMs(value: unknown): number | null {
	if (typeof value !== 'string' || !value.trim()) {
		return null;
	}
	const ms = Date.parse(value.trim());
	return Number.isFinite(ms) ? ms : null;
}

export function ensembleDocConfirmAskedAtMs(
	message: DesktopAiMessage
): number | null {
	const asked = parseIsoMs(message.metadata?.ensemble_doc_confirm_asked_at);
	if (asked != null) {
		return asked;
	}
	return parseIsoMs(message.created_at);
}

export function isEnsembleDocConfirmExpired(
	message: DesktopAiMessage,
	defaults: Record<string, unknown> | undefined,
	nowMs: number = Date.now()
): boolean {
	if (message.metadata?.ensemble_doc_confirm !== 'asked') {
		return false;
	}
	const askedAt = ensembleDocConfirmAskedAtMs(message);
	if (askedAt == null) {
		return false;
	}
	const ttlMs = resolveEnsembleDocConfirmTtlSeconds(defaults) * 1000;
	return nowMs > askedAt + ttlMs;
}
