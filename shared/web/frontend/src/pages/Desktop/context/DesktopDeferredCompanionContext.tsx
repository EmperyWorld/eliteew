/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deferred assistant selection rail + EWA companion shell bridge snapshots.
 *
 * Related:
 * - DesktopDeferredCompanionRuntime.tsx
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import * as React from 'react';
import type { EwaCompanionShellBridgeValue } from '../context/EwaCompanionShellBridgeContext';
import { EMPTY_EWA_COMPANION_SHELL_BRIDGE } from '../runtime/desktopDeferredCompanion';

export type DesktopDeferredCompanionState = {
	companionShellBridge: EwaCompanionShellBridgeValue;
	assistantSelectionRail: React.ReactNode;
};

const DesktopDeferredCompanionContext =
	React.createContext<DesktopDeferredCompanionState>({
		companionShellBridge: EMPTY_EWA_COMPANION_SHELL_BRIDGE,
		assistantSelectionRail: null,
	});

const DesktopDeferredCompanionSetContext = React.createContext<
	React.Dispatch<React.SetStateAction<DesktopDeferredCompanionState>>
>(() => {});

export function DesktopDeferredCompanionProvider({
	children,
}: {
	children: React.ReactNode;
}): React.JSX.Element {
	const [companion, setCompanion] = React.useState<DesktopDeferredCompanionState>(
		{
			companionShellBridge: EMPTY_EWA_COMPANION_SHELL_BRIDGE,
			assistantSelectionRail: null,
		}
	);
	return (
		<DesktopDeferredCompanionSetContext.Provider value={setCompanion}>
			<DesktopDeferredCompanionContext.Provider value={companion}>
				{children}
			</DesktopDeferredCompanionContext.Provider>
		</DesktopDeferredCompanionSetContext.Provider>
	);
}

export function useDesktopDeferredCompanion(): DesktopDeferredCompanionState {
	return React.useContext(DesktopDeferredCompanionContext);
}

export function useSetDesktopDeferredCompanion(): React.Dispatch<
	React.SetStateAction<DesktopDeferredCompanionState>
> {
	return React.useContext(DesktopDeferredCompanionSetContext);
}
