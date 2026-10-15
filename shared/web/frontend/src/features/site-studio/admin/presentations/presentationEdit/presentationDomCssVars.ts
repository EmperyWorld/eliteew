/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Imperative CSS custom-property assignment for presentation editor DOM nodes.
 *
 * Invariants:
 * - Empty or undefined values remove the corresponding property.
 *
 * Related:
 * - PresentationEditPage.tsx
 * - presentationEdit/PresentationEditColorSchemePreviewButton.tsx
 */

export function assignDomCssVars(
	el: HTMLElement | null,
	props: Record<string, string | undefined>
) {
	if (!el) return;
	for (const [key, value] of Object.entries(props)) {
		if (value !== undefined && value !== '') el.style.setProperty(key, value);
		else el.style.removeProperty(key);
	}
}
