import {
	createContext,
	useContext,
	useMemo,
	useState,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
} from 'react';

export type MarketingCabinetDashboardToolbarPortalContextValue = {
	mountNode: HTMLDivElement | null;
	setMountNode: Dispatch<SetStateAction<HTMLDivElement | null>>;
};

const MarketingCabinetDashboardToolbarPortalContext =
	createContext<MarketingCabinetDashboardToolbarPortalContextValue | null>(
		null
	);

export function MarketingCabinetDashboardToolbarPortalProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);
	const value = useMemo(() => ({ mountNode, setMountNode }), [mountNode]);
	return (
		<MarketingCabinetDashboardToolbarPortalContext.Provider value={value}>
			{children}
		</MarketingCabinetDashboardToolbarPortalContext.Provider>
	);
}

export function useMarketingCabinetDashboardToolbarPortal() {
	return useContext(MarketingCabinetDashboardToolbarPortalContext);
}
