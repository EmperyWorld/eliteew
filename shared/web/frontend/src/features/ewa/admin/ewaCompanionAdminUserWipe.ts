/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for admin Users memory-wipe confirm gate, soft clear confirm,
 * and API error classification.
 *
 * Invariants:
 * - Confirm must equal principal id / namespace after trim (case-sensitive).
 * - Wipe error kinds map 1:1 to backend HTTP detail codes where known.
 *
 * Related:
 * - src/features/ewa/admin/EwaCompanionUsersTab.tsx
 * - api/ewa_platform/gateways/routers/companion_admin.py
 */

export type WipeErrorKind =
	| 'confirm_mismatch'
	| 'qdrant_unavailable'
	| 'qdrant_purge_failed'
	| 'not_found'
	| 'generic';

export type WipeFeedbackTone = 'success' | 'error';

const DETAIL_TO_KIND: Record<string, WipeErrorKind> = {
	confirm_mismatch: 'confirm_mismatch',
	confirm_principal_id_mismatch: 'confirm_mismatch',
	companion_wipe_qdrant_unavailable: 'qdrant_unavailable',
	companion_wipe_qdrant_purge_failed: 'qdrant_purge_failed',
	companion_profile_not_found: 'not_found',
};

function extractErrorText(err: unknown): string {
	if (err == null) return '';
	if (typeof err === 'string') return err;
	if (err instanceof Error) {
		const withDetails = err as Error & { details?: unknown };
		const fromDetails =
			typeof withDetails.details === 'string'
				? withDetails.details
				: typeof withDetails.details === 'object' &&
						withDetails.details !== null &&
						'detail' in withDetails.details
					? String((withDetails.details as { detail?: unknown }).detail ?? '')
					: '';
		return `${err.message} ${fromDetails}`.trim();
	}
	return String(err);
}

export function confirmPrincipalIdMatches(
	principalId: string,
	typedConfirm: string
): boolean {
	return (
		principalId.trim().length > 0 && principalId.trim() === typedConfirm.trim()
	);
}

export function confirmNamespaceMatches(
	namespace: string,
	typedConfirm: string
): boolean {
	return (
		namespace.trim().length > 0 && namespace.trim() === typedConfirm.trim()
	);
}

/** Map wipe mutation failures to a stable kind for i18n. */
export function classifyWipeError(err: unknown): WipeErrorKind {
	const text = extractErrorText(err);
	for (const [needle, kind] of Object.entries(DETAIL_TO_KIND)) {
		if (text.includes(needle)) return kind;
	}
	return 'generic';
}
