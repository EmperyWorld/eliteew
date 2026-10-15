/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Barrel for Desktop shell platform modules (SLM + App Registry + Portal U1).
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md
 */

export {
	dismissCompanionCard,
	getCompanionViewPrefs,
	isMissionChromeCollapsed,
	setMissionCollapsed,
	subscribeShellLifecycle,
	type CompanionViewPrefs,
} from './shellLifecycleManager';

export {
	useCompanionViewPrefs,
	type CompanionSurfaceLifecycleAction,
	type UseCompanionViewPrefsResult,
} from './useCompanionViewPrefs';

export {
	assertShellAppRegistered,
	getShellAppCatalogSize,
	getShellAppRegistration,
	isShellAppSelfScroll,
	listShellAppRegistrations,
	registerDesktopShellApp,
	resolveWindowBodyScroll,
	type ResolvedWindowBodyScroll,
	type ShellAppRegistration,
	type ShellChromeProfile,
	type ShellPortalLayerKind,
	type ShellPortalPolicy,
	type ShellScrollMode,
} from './appRegistry';

export {
	ensureShellAppCatalogSeeded,
	SHELL_APP_SELF_SCROLL_IDS,
} from './appRegistry.catalog';

export {
	resolveWindowBodyScrollDomFlags,
	type WindowBodyScrollDomFlags,
} from './shellScroll';

export { resolveShellPortalLayerBump } from './portalLayerBumps';

export {
	closeShellPortalSurface,
	computeShellPortalZIndex,
	dismissTopShellPortalSurface,
	getShellPortalSurface,
	getTopShellPortalSurface,
	isTopShellPortalSurface,
	listShellPortalSurfaces,
	openShellPortalSurface,
	subscribeShellPortalStack,
	type OpenShellPortalSurfaceInput,
	type ShellPortalSurface,
} from './portalStackController';

export {
	ShellPortalMount,
	useShellPortal,
	type ShellPortalPropsBag,
	type UseShellPortalOptions,
	type UseShellPortalResult,
} from './shellPortal';

export { ShellBodyPortal, type ShellBodyPortalProps } from './shellBodyPortal';

export { getDesktopPortalShellProps } from './shellPortalTheme';

export {
	getShellChromeProfileTraits,
	resolveShellChromeProfile,
	resolveShellChromeTraits,
	type ShellChromeProfileTraits,
} from './shellChrome';

export {
	useShellChrome,
	type UseShellChromeResult,
} from './useShellChrome';

export {
	SHELL_SEMANTIC_CONTRACTS,
	type ShellSemanticContractId,
} from './shellSemanticContracts';
