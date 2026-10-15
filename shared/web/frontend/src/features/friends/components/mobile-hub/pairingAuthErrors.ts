/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Classifies pairing API authorization failures before the controller chooses recovery UX.
 *
 * Invariants:
 * - A trusted-user denial is distinguished from a stale OIDC session.
 *
 * Related:
 * - useMobileAppHubController.ts
 */

function responseOf(error: unknown): {
	status?: number;
	data?: { detail?: unknown };
} {
	if (!error || typeof error !== 'object') return {};
	return (
		(error as { response?: { status?: number; data?: { detail?: unknown } } })
			.response ?? {}
	);
}

export function getApiErrorDetail(error: unknown): string {
	const detail = responseOf(error).data?.detail;
	if (typeof detail === 'string') return detail;
	return detail == null ? '' : String(detail);
}

export function isForbiddenResponse(error: unknown): boolean {
	return responseOf(error).status === 403;
}

export function isTrustedUserRequiredError(error: unknown): boolean {
	return (
		isForbiddenResponse(error) &&
		getApiErrorDetail(error)
			.toLowerCase()
			.includes('trusted user status is required')
	);
}

export function isFreshAuthRequiredError(error: unknown): boolean {
	if (!isForbiddenResponse(error)) return false;
	const detail = getApiErrorDetail(error).toLowerCase();
	return (
		detail.includes('re-authenticate') ||
		detail.includes('fresh keycloak') ||
		detail.includes('fresh authentication')
	);
}
