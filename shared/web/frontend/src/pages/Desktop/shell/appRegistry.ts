/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Shell App Registry — static capability catalog for window scroll ownership
 * and portal policy (U1.a). EnhancedWindow resolves scroll from here; apps declare only.
 *
 * Invariants:
 * - Catalog is module-init only; no runtime app mutation of shell overflow.
 * - Folder windows never resolve as self-scroll (winType gate in resolveWindowBodyScroll).
 * - Unregistered appComponent defaults to outer scroll (dev/vitest may warn).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md
 * - shell/shellScroll.ts
 * - utils/desktopWindowBodyScrollRegistry.ts (legacy adapter)
 */

export type ShellScrollMode = 'self' | 'outer' | 'outer_preview';

export type ShellPortalPolicy = 'required' | 'optional' | 'forbidden';

export type ShellPortalLayerKind =
	| 'window_menu'
	| 'embedded_popover'
	| 'embedded_modal_backdrop'
	| 'embedded_modal'
	| 'doc_side_panel'
	| 'doc_toolbar_popover'
	| 'doc_context_menu'
	| 'shell_global';

export type ShellChromeProfile = 'standard' | 'settings' | 'iframe_launcher';

export type ShellAppRegistration = {
	appComponent: string;
	scroll: {
		mode: ShellScrollMode;
		/** In-app scroll root id (self mode); declaration + tests in U1.a. */
		scrollContainerId?: string;
	};
	portal: {
		policy: ShellPortalPolicy;
		defaultLayer: ShellPortalLayerKind;
	};
	chromeProfile: ShellChromeProfile;
	notes?: string;
};

export type ResolvedWindowBodyScroll = {
	mode: ShellScrollMode;
	scrollContainerId?: string;
};

const catalog = new Map<string, ShellAppRegistration>();

export function registerDesktopShellApp(reg: ShellAppRegistration): void {
	const id = reg.appComponent.trim();
	if (!id) {
		throw new Error('registerDesktopShellApp: appComponent is required');
	}
	catalog.set(id, { ...reg, appComponent: id });
}

export function getShellAppRegistration(
	appComponent: string | null | undefined
): ShellAppRegistration | null {
	const id = appComponent?.trim();
	if (!id) return null;
	return catalog.get(id) ?? null;
}

export function listShellAppRegistrations(): readonly ShellAppRegistration[] {
	return [...catalog.values()];
}

export function getShellAppCatalogSize(): number {
	return catalog.size;
}

/** Test/reset helper — not for production app code. */
export function __resetShellAppCatalogForTests(): void {
	catalog.clear();
}

/**
 * Resolve window-body scroll ownership for EnhancedWindow.
 * Folders and non-app types always outer (no self-scroll path).
 */
export function resolveWindowBodyScroll(
	windowType: string,
	appComponent?: string | null
): ResolvedWindowBodyScroll {
	if (windowType !== 'app') {
		return { mode: 'outer' };
	}
	const reg = getShellAppRegistration(appComponent);
	if (!reg) {
		return { mode: 'outer' };
	}
	return {
		mode: reg.scroll.mode,
		scrollContainerId: reg.scroll.scrollContainerId,
	};
}

export function isShellAppSelfScroll(
	windowType: string,
	appComponent?: string | null
): boolean {
	return resolveWindowBodyScroll(windowType, appComponent).mode === 'self';
}

export function assertShellAppRegistered(appComponent: string): void {
	const id = appComponent.trim();
	if (!id) {
		throw new Error('assertShellAppRegistered: empty appComponent');
	}
	if (!catalog.has(id)) {
		throw new Error(
			`assertShellAppRegistered: "${id}" is not in Shell App Registry`
		);
	}
}
