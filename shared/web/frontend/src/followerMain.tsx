/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Minimal SPA entry for non-leader browser tabs — no desktop/admin bundles, no gated REST.
 * Leadership promotion loads the full application in-place instead of asking for a reload.
 *
 * Related:
 * - `tabBootstrap.ts`, `main.tsx`, `mainFullApp.ts`
 */

import {
	createElement,
	useCallback,
	useEffect,
	useRef,
	type ReactElement,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import {
	BrowserTabLeaderProvider,
	useBrowserTabLeader,
} from './contexts/BrowserTabLeaderProvider';
import { BrowserSingleTabGateScreen } from './components/browserTabGate/BrowserSingleTabGateScreen';
import { PassiveFollowerTabScreen } from './components/PassiveFollowerTabScreen';
import { followerI18nReady, initFollowerI18n } from './i18n/initFollowerI18n';
import i18n from 'i18next';
import { readBootstrapUserId } from './tabBootstrap';
import {
	setBrowserTabLeaderRole,
	setSingleTabPolicyEnabled,
} from './utils/browserTabLeaderState';
import { completeAppPreloaderHandoff } from './utils/appPreloader';
import './styles/index.css';

let followerRoot: Root | null = null;
let promotingToFullApp = false;

async function promoteFollowerToFullApp(): Promise<void> {
	if (promotingToFullApp) {
		return;
	}
	promotingToFullApp = true;
	followerRoot?.unmount();
	followerRoot = null;
	delete document.documentElement.dataset.eliteewTabRole;
	await import('./mainFullApp');
}

function FollowerScreen(): ReactElement {
	const { requestLeadershipHandoff, isHandoffWaiting, isFollower } =
		useBrowserTabLeader();
	const promotionStartedRef = useRef(false);

	useEffect(() => {
		if (isFollower || isHandoffWaiting || promotionStartedRef.current) {
			return;
		}
		promotionStartedRef.current = true;
		void promoteFollowerToFullApp();
	}, [isFollower, isHandoffWaiting]);

	const onTakeLeadership = useCallback(async () => {
		const result = await requestLeadershipHandoff();
		if (result === 'granted' || result === 'immediate') {
			void promoteFollowerToFullApp();
		}
	}, [requestLeadershipHandoff]);

	if (isHandoffWaiting) {
		return <BrowserSingleTabGateScreen mode="handoffWaiting" />;
	}

	return (
		<PassiveFollowerTabScreen
			contextLabel="EliteEW"
			onTakeLeadership={() => {
				void onTakeLeadership();
			}}
		/>
	);
}

function FollowerShell(): ReactElement {
	const userId = readBootstrapUserId();
	setSingleTabPolicyEnabled(Boolean(userId));
	setBrowserTabLeaderRole('follower');

	return (
		<I18nextProvider i18n={i18n}>
			<BrowserTabLeaderProvider userId={userId}>
				<FollowerScreen />
			</BrowserTabLeaderProvider>
		</I18nextProvider>
	);
}

export async function mountFollowerEntry(): Promise<void> {
	await initFollowerI18n();
	await followerI18nReady;
	const rootEl = document.getElementById('root');
	if (!rootEl) {
		return;
	}
	followerRoot = createRoot(rootEl);
	followerRoot.render(createElement(FollowerShell));
	completeAppPreloaderHandoff();
}

void mountFollowerEntry();
