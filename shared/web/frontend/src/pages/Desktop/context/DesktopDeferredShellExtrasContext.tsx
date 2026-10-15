/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Always-on context for deferred Desktop extras. The provider stays mounted;
 * a lazy runtime fills values after critical shell commit.
 *
 * Invariants:
 * - Does not remount `#desktop-main`, taskbar, icons, or window frames.
 * - Default extras are empty so first paint does not wait on GAF/friends/feed.
 *
 * Related:
 * - DesktopDeferredShellExtrasRuntime.tsx
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import * as React from 'react';
import {
	EMPTY_DESKTOP_DEFERRED_SHELL_EXTRAS,
	type DesktopDeferredShellExtras,
} from '../runtime/desktopDeferredShellExtras';

const DesktopDeferredShellExtrasContext =
	React.createContext<DesktopDeferredShellExtras>(
		EMPTY_DESKTOP_DEFERRED_SHELL_EXTRAS
	);

const DesktopDeferredShellExtrasSetContext = React.createContext<
	React.Dispatch<React.SetStateAction<DesktopDeferredShellExtras>>
>(() => {});

export function DesktopDeferredShellExtrasProvider({
	children,
}: {
	children: React.ReactNode;
}): React.JSX.Element {
	const [extras, setExtras] = React.useState<DesktopDeferredShellExtras>(
		EMPTY_DESKTOP_DEFERRED_SHELL_EXTRAS
	);
	return (
		<DesktopDeferredShellExtrasSetContext.Provider value={setExtras}>
			<DesktopDeferredShellExtrasContext.Provider value={extras}>
				{children}
			</DesktopDeferredShellExtrasContext.Provider>
		</DesktopDeferredShellExtrasSetContext.Provider>
	);
}

export function useDesktopDeferredShellExtras(): DesktopDeferredShellExtras {
	return React.useContext(DesktopDeferredShellExtrasContext);
}

export function useSetDesktopDeferredShellExtras(): React.Dispatch<
	React.SetStateAction<DesktopDeferredShellExtras>
> {
	return React.useContext(DesktopDeferredShellExtrasSetContext);
}
