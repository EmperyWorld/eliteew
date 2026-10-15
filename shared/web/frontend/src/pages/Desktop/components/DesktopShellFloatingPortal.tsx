/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deprecated U2 adapter name — re-exports ShellPortalMount (useShellPortal).
 * Apps must import ShellPortalMount / useShellPortal from pages/Desktop/shell.
 *
 * Invariants:
 * - No createPortal here; sole body portal remains shellBodyPortal.
 *
 * Related:
 * - shell/shellPortal.tsx
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md
 */

export {
	ShellPortalMount as DesktopShellFloatingPortal,
	type UseShellPortalOptions as DesktopShellFloatingPortalProps,
} from '../shell/shellPortal';
