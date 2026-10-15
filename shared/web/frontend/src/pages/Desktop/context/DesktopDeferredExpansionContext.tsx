/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Always-on context for deferred Desktop expansion settings.
 *
 * Invariants:
 * - Provider stays mounted; lazy runtime fills values after critical shell commit.
 * - Default is EMPTY so first paint does not wait on shell_state expansion fetch.
 *
 * Related:
 * - DesktopDeferredExpansionRuntime.tsx
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import * as React from 'react';
import type { DesktopExpansionSettings } from '../types/desktopExpansion.types';
import { EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS } from '../runtime/desktopDeferredExpansionSettings';

const DesktopDeferredExpansionContext =
	React.createContext<DesktopExpansionSettings>(
		EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS
	);

const DesktopDeferredExpansionSetContext = React.createContext<
	React.Dispatch<React.SetStateAction<DesktopExpansionSettings>>
>(() => {});

export function DesktopDeferredExpansionProvider({
	children,
}: {
	children: React.ReactNode;
}): React.JSX.Element {
	const [expansion, setExpansion] = React.useState<DesktopExpansionSettings>(
		EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS
	);
	return (
		<DesktopDeferredExpansionSetContext.Provider value={setExpansion}>
			<DesktopDeferredExpansionContext.Provider value={expansion}>
				{children}
			</DesktopDeferredExpansionContext.Provider>
		</DesktopDeferredExpansionSetContext.Provider>
	);
}

export function useDesktopDeferredExpansion(): DesktopExpansionSettings {
	return React.useContext(DesktopDeferredExpansionContext);
}

export function useSetDesktopDeferredExpansion(): React.Dispatch<
	React.SetStateAction<DesktopExpansionSettings>
> {
	return React.useContext(DesktopDeferredExpansionSetContext);
}
