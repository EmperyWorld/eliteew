/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared vertical slug resolution for Professional Worlds desktop runtime.
 *
 * Invariants:
 * - `DEFAULT_FALLBACK_VERTICAL` is legacy single-vertical default until user picks an activation.
 * - Prefer explicit user activations over implicit slug fallbacks.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - verticalModuleLogic.ts
 */

/** Legacy default when no activation exists (realtor MVP). */
export const DEFAULT_FALLBACK_VERTICAL = 'realtor';

export type ProfessionalVerticalActivation = {
	vertical_slug: string;
	is_active?: boolean;
};

/**
 * Resolve the active vertical slug from user activations.
 * Prefers the first active activation; falls back to legacy realtor default.
 */
export function resolveActiveVerticalSlug(
	activations: ProfessionalVerticalActivation[] | null | undefined,
	preferredSlug?: string | null
): string {
	const rows = activations ?? [];
	const normalizedPreferred = preferredSlug?.trim();
	if (normalizedPreferred) {
		const match = rows.find(
			(row) =>
				row.vertical_slug === normalizedPreferred && row.is_active !== false
		);
		if (match) {
			return match.vertical_slug;
		}
	}
	const active = rows.find((row) => row.is_active !== false);
	if (active?.vertical_slug) {
		return active.vertical_slug;
	}
	return DEFAULT_FALLBACK_VERTICAL;
}

/** Playbooks module key follows `{vertical_slug}_playbooks` convention. */
export function playbooksModuleKeyForVertical(verticalSlug: string): string {
	const slug = verticalSlug.trim() || DEFAULT_FALLBACK_VERTICAL;
	return `${slug.replace(/-/g, '_')}_playbooks`;
}
