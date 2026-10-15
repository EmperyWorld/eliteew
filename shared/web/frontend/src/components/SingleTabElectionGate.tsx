/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Blocks heavy app subtree (Query, desktop bundles, gated REST) until tab role is resolved.
 *
 * Invariants:
 * - Runs inside BrowserTabLeaderProvider; embedded WebView clients bypass entirely.
 * - Handoff / follower copy and chrome come from `BrowserSingleTabGateScreen`.
 *
 * Related:
 * - `App.tsx`, `components/PassiveFollowerTabScreen.tsx`
 */

import { useBrowserTabLeader } from '@/contexts/BrowserTabLeaderProvider';
import type { ShellPageType } from '@/hooks/useAppState';
import { requiresSingleBrowserTab } from '@/utils/requiresSingleBrowserTab';
import type { ReactNode } from 'react';
import { BrowserSingleTabGateScreen } from './browserTabGate/BrowserSingleTabGateScreen';
import { PassiveFollowerTabScreen } from './PassiveFollowerTabScreen';

type SingleTabElectionGateProps = {
	currentPage: ShellPageType;
	isAuthenticated: boolean;
	isAuthLoading?: boolean;
	children: ReactNode;
};

function HandoffWaitingScreen(): React.ReactElement {
	return <BrowserSingleTabGateScreen mode="handoffWaiting" />;
}

export function SingleTabElectionGate({
	currentPage,
	isAuthenticated: _isAuthenticated,
	isAuthLoading: _isAuthLoading = false,
	children,
}: SingleTabElectionGateProps): React.ReactElement {
	const {
		skipSingleTabPolicy,
		isFollower,
		isHandoffWaiting,
		requestLeadershipHandoff,
	} = useBrowserTabLeader();

	if (skipSingleTabPolicy || !requiresSingleBrowserTab(currentPage)) {
		return <>{children}</>;
	}

	// Auth + tab role probing during login: AppRouter owns login/desktop loaders.

	if (isHandoffWaiting) {
		return <HandoffWaitingScreen />;
	}

	if (isFollower) {
		return (
			<PassiveFollowerTabScreen
				contextLabel="EliteEW"
				onTakeLeadership={() => {
					void requestLeadershipHandoff();
				}}
			/>
		);
	}

	return <>{children}</>;
}
