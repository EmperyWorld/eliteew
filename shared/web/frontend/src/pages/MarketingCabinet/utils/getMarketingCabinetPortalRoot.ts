/**
 * Mount target for marketing cabinet portals (select listbox, popovers, modals).
 * Desktop tokens (`--desktop-*`, accent) are set on `.desktop-workspace-shell` (see DesktopWorkspaceContent);
 * `document.body` is outside that subtree, so portaling there makes surfaces look unstyled / “default”.
 */
export function getMarketingCabinetPortalRoot(
	anchor: HTMLElement | null
): HTMLElement {
	if (anchor) {
		const mc = anchor.closest(
			'[data-marketing-cabinet-shell]'
		) as HTMLElement | null;
		if (mc) return mc;
		const shell = anchor.closest(
			'.desktop-workspace-shell'
		) as HTMLElement | null;
		if (shell) return shell;
	}
	const fallback = document.querySelector(
		'.desktop-workspace-shell'
	) as HTMLElement | null;
	return fallback ?? document.body;
}
