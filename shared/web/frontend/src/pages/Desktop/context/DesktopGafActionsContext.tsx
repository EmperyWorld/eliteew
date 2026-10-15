/**
 * Lets GAF Chat (and related UI) open desktop apps in a new window, matching desktop launch semantics.
 */
import * as React from 'react';

export type DesktopGafSocialHubTab = 'friends' | 'phone' | 'inbox' | 'circles';

/** GAF deep-link tabs plus shell Social Hub launch hints. */
export type DesktopSocialHubOpenTab =
	| DesktopGafSocialHubTab
	| 'overview'
	| 'profile'
	| 'mobile-app';

export type DesktopGafOpenActions = {
	openAppByComponent: (appComponent: string) => void;
	/** Opens Social Hub on a specific tab (e.g. phone binding for GAF E2EE). */
	openSocialHubTab?: (tab?: DesktopSocialHubOpenTab) => void;
};

const DesktopGafActionsContext =
	React.createContext<DesktopGafOpenActions | null>(null);

export function DesktopGafActionsProvider({
	value,
	children,
}: {
	value: DesktopGafOpenActions;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<DesktopGafActionsContext.Provider value={value}>
			{children}
		</DesktopGafActionsContext.Provider>
	);
}

export function useDesktopGafOpenActions(): DesktopGafOpenActions | null {
	return React.useContext(DesktopGafActionsContext);
}
