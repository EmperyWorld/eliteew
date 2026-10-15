/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared extraction of user-facing API error messages for profile panels.
 *
 * Invariants:
 * - Prefer `response.data.message` when present; otherwise fallback.
 *
 * Related:
 * - ProfileIdentityPanel.tsx
 * - ProfileAvatarPanel.tsx
 */

export function profileApiErrorMessage(err: unknown, fallback: string): string {
	if (
		err &&
		typeof err === 'object' &&
		'response' in err &&
		err.response &&
		typeof err.response === 'object' &&
		'data' in err.response &&
		err.response.data &&
		typeof err.response.data === 'object' &&
		'message' in err.response.data &&
		typeof (err.response.data as { message: unknown }).message === 'string'
	) {
		return (err.response.data as { message: string }).message;
	}
	return fallback;
}
