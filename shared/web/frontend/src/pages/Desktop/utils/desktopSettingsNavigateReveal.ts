/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reveal Settings deep-link targets: open ancestor disclosures and Fine-tune
 * font panes before scrollIntoView.
 *
 * Invariants:
 * - Does not invent tabs; only mutates DOM open state / clicks existing triggers.
 *
 * Related:
 * - `components/DesktopSettingsPanel.tsx`
 * - `documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md`
 */

/** Open every closed `<details>` ancestor so nested field ids are visible. */
export function openAncestorDetailsElements(el: HTMLElement): void {
	let node: HTMLElement | null = el;
	while (node) {
		if (node instanceof HTMLDetailsElement && !node.open) {
			node.open = true;
		}
		node = node.parentElement;
	}
}

/**
 * If the target is a Fine-tune font pane, activate Body|Display segment so the
 * grid is not `hidden` after deep-link.
 */
export function activateFinetuneFontPaneForElement(el: HTMLElement): void {
	const pane = el.getAttribute('data-finetune-font-pane');
	if (pane !== 'body' && pane !== 'display') return;
	const root = el.closest(
		'[data-testid="desktop-settings-finetune-fonts-chooser"]'
	);
	if (!root) return;
	const trigger = root.querySelector(
		`[data-finetune-font-pane-trigger="${pane}"]`
	);
	if (trigger instanceof HTMLElement) {
		trigger.click();
	}
}

/** Prepare a Settings field element for scroll/focus after navigate. */
export function revealDesktopSettingsNavigateTarget(el: HTMLElement): void {
	openAncestorDetailsElements(el);
	activateFinetuneFontPaneForElement(el);
}
