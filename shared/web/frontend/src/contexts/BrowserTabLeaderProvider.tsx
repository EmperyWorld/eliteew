/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App-level browser tab leadership: sync election, handoff confirmation, socket mutex.
 *
 * Invariants:
 * - Embedded WebView (Android/Meta APK) skips policy — always leader.
 * - Live socket handoff requires 60s confirm dialog on the current leader tab only.
 *
 * Related:
 * - `components/SingleTabElectionGate.tsx`, `components/BrowserTabHandoffDialog.tsx`
 */

import { BrowserTabHandoffDialog } from '@/components/BrowserTabHandoffDialog';
import {
	detectSyncBrowserTabRole,
	HANDOFF_TIMEOUT_MS,
	subscribeBrowserTabLeadership,
	type BrowserTabLeadershipRole,
	type HandoffRequestPayload,
	type HandoffResult,
} from '@/pages/Desktop/utils/desktopRealtimeLeader';
import { isEmbeddedEliteEWClient } from '@/utils/eliteewEmbeddedClient';
import {
	isBrowserTabSocketConnected,
	setBrowserTabLeaderRole,
	setSingleTabPolicyEnabled,
} from '@/utils/browserTabLeaderState';
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react';

type BrowserTabLeaderContextValue = {
	role: BrowserTabLeadershipRole;
	isLeader: boolean;
	isFollower: boolean;
	isHandoffWaiting: boolean;
	skipSingleTabPolicy: boolean;
	isSocketOwner: boolean;
	requestLeadershipHandoff: () => Promise<HandoffResult>;
	yieldLeadership: () => void;
};

const defaultValue: BrowserTabLeaderContextValue = {
	role: 'leader',
	isLeader: true,
	isFollower: false,
	isHandoffWaiting: false,
	skipSingleTabPolicy: true,
	isSocketOwner: true,
	requestLeadershipHandoff: async () => 'denied' as HandoffResult,
	yieldLeadership: () => {},
};

const BrowserTabLeaderContext =
	createContext<BrowserTabLeaderContextValue>(defaultValue);

export function useBrowserTabLeader(): BrowserTabLeaderContextValue {
	return useContext(BrowserTabLeaderContext);
}

type BrowserTabLeaderProviderProps = {
	userId: string | null | undefined;
	/** When false (e.g. mobile-app-download), no heartbeat / handoff / socket mutex. */
	policyActive?: boolean;
	children: ReactNode;
};

export function BrowserTabLeaderProvider({
	userId,
	policyActive = true,
	children,
}: BrowserTabLeaderProviderProps): React.ReactElement {
	const embedded = isEmbeddedEliteEWClient();
	const skipPolicy = embedded || !userId || !policyActive;

	const initialRole: BrowserTabLeadershipRole =
		skipPolicy || !userId ? 'leader' : detectSyncBrowserTabRole(userId);

	const [role, setRole] = useState<BrowserTabLeadershipRole>(initialRole);
	const [isSocketOwner, setIsSocketOwner] = useState(skipPolicy);
	const [isHandoffWaiting, setIsHandoffWaiting] = useState(false);
	const [handoffPrompt, setHandoffPrompt] =
		useState<HandoffRequestPayload | null>(null);
	const [handoffSecondsLeft, setHandoffSecondsLeft] = useState(60);

	const controllerRef = useRef<ReturnType<
		typeof subscribeBrowserTabLeadership
	> | null>(null);

	useEffect(() => {
		setSingleTabPolicyEnabled(!skipPolicy);
		setBrowserTabLeaderRole(initialRole);
	}, [skipPolicy, initialRole]);

	useEffect(() => {
		setBrowserTabLeaderRole(role);
	}, [role]);

	useEffect(() => {
		if (skipPolicy || !userId) {
			setRole('leader');
			setIsSocketOwner(true);
			setBrowserTabLeaderRole('leader');
			return;
		}

		setRole(detectSyncBrowserTabRole(userId));
		setIsSocketOwner(false);

		const ctl = subscribeBrowserTabLeadership(userId, {
			onRoleChange: setRole,
			onAcquire: () => setIsSocketOwner(true),
			onRelease: () => setIsSocketOwner(false),
			onHandoffRequest: (payload) => {
				setHandoffPrompt(payload);
				setHandoffSecondsLeft(Math.ceil(HANDOFF_TIMEOUT_MS / 1000));
			},
			onHandoffWaiting: setIsHandoffWaiting,
			getSocketConnected: () => isBrowserTabSocketConnected(),
		});
		controllerRef.current = ctl;
		return () => {
			controllerRef.current = null;
			setIsSocketOwner(false);
			setHandoffPrompt(null);
			setIsHandoffWaiting(false);
			ctl.dispose();
		};
	}, [skipPolicy, userId]);

	useEffect(() => {
		if (!handoffPrompt) {
			return;
		}
		const started = Date.now();
		const timer = window.setInterval(() => {
			const elapsed = Date.now() - started;
			const left = Math.max(
				0,
				Math.ceil((HANDOFF_TIMEOUT_MS - elapsed) / 1000)
			);
			setHandoffSecondsLeft(left);
			if (left <= 0) {
				controllerRef.current?.respondToHandoff(handoffPrompt.requestId, false);
				setHandoffPrompt(null);
			}
		}, 500);
		return () => window.clearInterval(timer);
	}, [handoffPrompt]);

	const requestLeadershipHandoff =
		useCallback(async (): Promise<HandoffResult> => {
			if (!controllerRef.current) {
				return 'denied';
			}
			return controllerRef.current.requestLeadershipHandoff();
		}, []);

	const yieldLeadership = useCallback(() => {
		controllerRef.current?.yieldLeadership();
	}, []);

	const respondHandoff = useCallback(
		(accepted: boolean) => {
			if (!handoffPrompt) {
				return;
			}
			controllerRef.current?.respondToHandoff(
				handoffPrompt.requestId,
				accepted
			);
			setHandoffPrompt(null);
		},
		[handoffPrompt]
	);

	const value = useMemo<BrowserTabLeaderContextValue>(
		() => ({
			role,
			isLeader: role === 'leader',
			isFollower: role === 'follower',
			isHandoffWaiting,
			skipSingleTabPolicy: skipPolicy,
			isSocketOwner,
			requestLeadershipHandoff,
			yieldLeadership,
		}),
		[
			role,
			isHandoffWaiting,
			skipPolicy,
			isSocketOwner,
			requestLeadershipHandoff,
			yieldLeadership,
		]
	);

	return (
		<BrowserTabLeaderContext.Provider value={value}>
			{children}
			{handoffPrompt && role === 'leader' ? (
				<BrowserTabHandoffDialog
					secondsLeft={handoffSecondsLeft}
					onAccept={() => respondHandoff(true)}
					onDeny={() => respondHandoff(false)}
				/>
			) : null}
		</BrowserTabLeaderContext.Provider>
	);
}
