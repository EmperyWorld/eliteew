/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Корневой UI после bounded OIDC bootstrap + AuthProvider + AppState (см. `mainFullApp.ts`). Провайдеры: Query, тема,
 * настройки, голос, уведомления и planned maintenance UX. Синхронизация hash ↔ currentPage; SSO redirect — только через `LoginPageFallback` / `beginInteractiveLogin`.
 *
 * Invariants:
 * - Нет параллельного app-gate redirect: login fallback — единая точка старта PKCE.
 * - Intended page сохраняется через `beginInteractiveLogin` / normalizeRedirectUri.
 *
 * Related:
 * - `services/boot/authBootstrap.ts`, `AuthContext.tsx`, `utils/authRedirect.ts`, `documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md`
 */
import { getPageLabel } from '@/config/pageNavigation';
import { NotificationProvider } from '@/notifications';
import { notify } from '@/notifications/api';
import {
	useCallback,
	useEffect,
	useRef,
	type FC,
	type ReactNode,
	useSyncExternalStore,
} from 'react';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AppRouter } from './components/AppRouter';
import { PROFILE_RETURN_TO_SESSION_KEY } from './constants/storageKeys';
import { BrowserTabLeaderProvider } from './contexts/BrowserTabLeaderProvider';
import { SingleTabElectionGate } from './components/SingleTabElectionGate';
import { markBootPerformance } from './services/boot/bootPerformance';
import { detectSyncBrowserTabRole } from './pages/Desktop/utils/desktopRealtimeLeader';
import { isEmbeddedEliteEWClient } from './utils/eliteewEmbeddedClient';
import {
	setBrowserTabLeaderRole,
	setSingleTabPolicyEnabled,
} from './utils/browserTabLeaderState';
import { requiresSingleBrowserTab } from '@/utils/requiresSingleBrowserTab';
import { isDesktopShellRoute } from '@/utils/desktopShellRoute';
import {
	getCurrentMaintenanceStatus,
	isMaintenanceGatePhase,
	subscribeMaintenanceStatus,
} from '@/services/maintenance/maintenanceState';
import { GlobalDesktopShellFrameProvider } from './contexts/GlobalDesktopShellFrameProvider';
import { MaintenanceProvider } from './contexts/MaintenanceContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { UserPreferencesAppProvider } from './contexts/UserPreferencesAppContext';
import {
	useAppState,
	useAuth,
	usePerformance,
	useSocketConnection,
	type PageType,
	type PerformanceMetrics,
} from './hooks';
import {
	resolveUgsDesktopDeepLink,
	storeUgsDesktopDeepLink,
} from './pages/Desktop/utils/ugsDesktopDeepLink';
import { QueryProvider } from './providers/QueryProvider';
import type { User } from './services';
import { log } from './utils/logger';
import {
	DEFAULT_PAGE,
	consumeIntendedPage,
	isOAuthCallbackHash,
	normalizePageCandidate,
	readStoredPreferredPage,
	syncLocationHashToPage,
} from './utils/pageRouting';
import { DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import { VoiceSettingsProvider } from './voice-core';

/** Слушатели navigator.onLine — только внутри NotificationProvider (Sonner уже смонтирован). */
function ConnectivityToasts(): null {
	useEffect(() => {
		const onOffline = (): void => {
			notify.warning(
				'Нет сети',
				'Проверьте подключение. Изменения могут не сохраниться.'
			);
		};
		const onOnline = (): void => {
			notify.info('Соединение восстановлено', '');
		};
		window.addEventListener('offline', onOffline);
		window.addEventListener('online', onOnline);
		return (): void => {
			window.removeEventListener('offline', onOffline);
			window.removeEventListener('online', onOnline);
		};
	}, []);
	return null;
}

function SkipToMainLink(): ReactNode {
	return (
		<a
			href="#app-main"
			className="fixed left-4 top-0 -translate-y-full rounded-b-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-950 motion-reduce:transition-none"
			style={{ zIndex: DESKTOP_Z_INDEX.SKIP_LINK }}
		>
			Перейти к содержимому
		</a>
	);
}

function AppSocketBridge({
	autoConnect,
	onConnectionChange,
	onMessage,
}: {
	autoConnect: boolean;
	onConnectionChange: (connected: boolean) => void;
	onMessage: (event: string, data: unknown) => void;
}): null {
	useSocketConnection(onConnectionChange, onMessage, { autoConnect });
	return null;
}

const App: FC = () => {
	// Deploy detection: `startDeployVersionWatcher()` in mainFullApp.ts (app-build-version.txt + circuit breaker).

	const { state, actions } = useAppState();
	const auth = useAuth();
	const currentPageRef = useRef(state.currentPage);
	useEffect(() => {
		currentPageRef.current = state.currentPage;
	}, [state.currentPage]);

	const singleTabPolicyActive = requiresSingleBrowserTab(state.currentPage);

	useEffect(() => {
		// Sync tab role for desktop/admin routes once auth/page state is committed.
		if (auth.isAuthenticated && auth.user?.id) {
			if (isEmbeddedEliteEWClient() || !singleTabPolicyActive) {
				setSingleTabPolicyEnabled(false);
				setBrowserTabLeaderRole('leader');
				return;
			}
			setSingleTabPolicyEnabled(true);
			setBrowserTabLeaderRole(detectSyncBrowserTabRole(auth.user.id));
			return;
		}
		setSingleTabPolicyEnabled(false);
		setBrowserTabLeaderRole('leader');
	}, [auth.isAuthenticated, auth.user?.id, singleTabPolicyActive]);

	const handlePerformanceUpdate = useCallback(
		(metrics: PerformanceMetrics) => {
			actions.updatePerformance(metrics);
		},
		[actions]
	);
	usePerformance(handlePerformanceUpdate);

	const getFallbackPage = useCallback((): PageType => {
		const hashCandidate = window.location.hash.slice(1);
		if (resolveUgsDesktopDeepLink(hashCandidate)) {
			storeUgsDesktopDeepLink(hashCandidate);
			return 'desktop';
		}

		const storedPage = readStoredPreferredPage() as PageType | null;
		if (resolveUgsDesktopDeepLink(storedPage)) {
			storeUgsDesktopDeepLink(storedPage);
			return 'desktop';
		}

		return (
			(normalizePageCandidate(window.location.hash) as PageType | null) ??
			storedPage ??
			currentPageRef.current ??
			DEFAULT_PAGE
		);
	}, []);

	useEffect(() => {
		actions.setAuthenticated(auth.isAuthenticated);
		actions.setUser(auth.user as User | null);
		actions.setLoading(auth.loading);

		if (!auth.loading) {
			markBootPerformance('auth-context-ready');
		}

		if (auth.isAuthenticated && !auth.loading) {
			const restoredTarget =
				consumeIntendedPage() ??
				window.location.hash.slice(1) ??
				getFallbackPage();

			const restoredUgsDeepLink = resolveUgsDesktopDeepLink(restoredTarget);
			if (restoredUgsDeepLink) {
				storeUgsDesktopDeepLink(restoredUgsDeepLink);
			}

			const restoredPage = restoredUgsDeepLink
				? 'desktop'
				: ((normalizePageCandidate(
						String(restoredTarget)
					) as PageType | null) ?? getFallbackPage());

			if (restoredUgsDeepLink) {
				syncLocationHashToPage('desktop');
			} else if (isOAuthCallbackHash(window.location.hash)) {
				syncLocationHashToPage(restoredPage);
			}

			const shellPage = currentPageRef.current;
			if (restoredPage !== shellPage) {
				log.info('App', `Restoring authenticated route: ${restoredPage}`);
				actions.setCurrentPage(restoredPage);
			}
		}
	}, [auth.isAuthenticated, auth.user, auth.loading, actions, getFallbackPage]);

	useEffect(() => {
		const handleHashChange = (): void => {
			const shellPage = currentPageRef.current;
			const hash = window.location.hash.slice(1);

			if (!hash || isOAuthCallbackHash(hash)) {
				const fallbackPage = getFallbackPage();
				syncLocationHashToPage(fallbackPage);
				if (fallbackPage !== shellPage) {
					actions.setCurrentPage(fallbackPage);
				}
				return;
			}

			const ugsDeepLink = resolveUgsDesktopDeepLink(hash);
			if (ugsDeepLink) {
				storeUgsDesktopDeepLink(ugsDeepLink);
				syncLocationHashToPage('desktop');
				if (shellPage !== 'desktop') {
					actions.setCurrentPage('desktop');
				}
				return;
			}

			const newPage =
				(normalizePageCandidate(hash) as PageType | null) ?? getFallbackPage();
			syncLocationHashToPage(newPage, hash);
			if (newPage !== shellPage) {
				log.info('App', `Hash navigation: ${newPage}`);
				actions.setCurrentPage(newPage);
			}
		};

		handleHashChange();

		window.addEventListener('hashchange', handleHashChange);
		return (): void => {
			window.removeEventListener('hashchange', handleHashChange);
		};
	}, [actions, getFallbackPage]);

	const maintenanceStatus = useSyncExternalStore(
		subscribeMaintenanceStatus,
		getCurrentMaintenanceStatus,
		getCurrentMaintenanceStatus
	);

	useEffect(() => {
		const maintenanceGateActive =
			state.currentPage === 'desktop' &&
			isDesktopShellRoute() &&
			maintenanceStatus.active &&
			maintenanceStatus.window &&
			(isMaintenanceGatePhase(maintenanceStatus) ||
				maintenanceStatus.window.phase === 'recovering');
		const label = maintenanceGateActive
			? getPageLabel('desktop')
			: getPageLabel(state.currentPage);
		document.title = label ? `${label} · EliteEW` : 'EliteEW';
		if (state.currentPage !== 'desktop') {
			window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
		}
	}, [state.currentPage, maintenanceStatus]);

	const handlePageChange = useCallback(
		(page: PageType | string) => {
			const rawTarget = String(page).replace(/^#/, '');
			const ugsDeepLink = resolveUgsDesktopDeepLink(rawTarget);
			if (ugsDeepLink) {
				storeUgsDesktopDeepLink(ugsDeepLink);
				if (state.currentPage !== 'desktop') {
					actions.setCurrentPage('desktop');
				}
				syncLocationHashToPage('desktop');
				return;
			}

			const targetPage = (normalizePageCandidate(rawTarget) ??
				DEFAULT_PAGE) as PageType;
			if (targetPage === 'user-profile') {
				try {
					sessionStorage.setItem(
						PROFILE_RETURN_TO_SESSION_KEY,
						state.currentPage
					);
				} catch {
					// ignore
				}
			}
			if (targetPage !== state.currentPage) {
				actions.setCurrentPage(targetPage);
			}

			syncLocationHashToPage(targetPage, rawTarget);
		},
		[actions, state.currentPage]
	);

	return (
		<AppErrorBoundary resetKey={state.currentPage}>
			<BrowserTabLeaderProvider
				userId={auth.user?.id ?? null}
				policyActive={singleTabPolicyActive}
			>
				<SingleTabElectionGate
					currentPage={state.currentPage}
					isAuthenticated={auth.isAuthenticated}
					isAuthLoading={auth.loading}
				>
					<QueryProvider>
						<ThemeProvider>
							<UserPreferencesAppProvider>
								<AppSocketBridge
									autoConnect={
										auth.isAuthenticated &&
										!auth.loading &&
										state.currentPage !== 'desktop' &&
										state.currentPage !== 'mobile-app-download' &&
										state.currentPage !== 'login' &&
										state.currentPage !== 'mobile-ewa-companion' &&
										state.currentPage !== 'mobile-handbook' &&
										state.currentPage !== 'mobile-social-hub' &&
										state.currentPage !== 'mobile-feedback-hub' &&
										state.currentPage !== 'mobile-notifications' &&
										state.currentPage !== 'mobile-content-manager' &&
										state.currentPage !== 'mobile-ewdesk' &&
										state.currentPage !== 'mobile-professional-worlds' &&
										state.currentPage !== 'mobile-app-store' &&
										state.currentPage !== 'mobile-desktop-settings' &&
										state.currentPage !== 'empery-nexus'
									}
									onConnectionChange={(connected): void => {
										actions.updateWebSocket({ connected });
									}}
									onMessage={(event, data): void => {
										actions.updateWebSocket({
											lastMessage: { type: event, data },
										});
									}}
								/>
								<GlobalDesktopShellFrameProvider>
									<VoiceSettingsProvider>
										<NotificationProvider>
											<MaintenanceProvider>
												<SkipToMainLink />
												<ConnectivityToasts />
												<main
													id="app-main"
													tabIndex={-1}
													className="flex min-h-0 w-full flex-1 flex-col outline-none"
												>
													<AppRouter
														currentPage={state.currentPage}
														isAuthenticated={auth.isAuthenticated}
														isAuthLoading={auth.loading}
														user={auth.user as User | null}
														onPageChange={handlePageChange}
														onUserUpdate={actions.setUser}
														theme={state.theme}
														settings={state.settings}
													/>
												</main>
											</MaintenanceProvider>
										</NotificationProvider>
									</VoiceSettingsProvider>
								</GlobalDesktopShellFrameProvider>
							</UserPreferencesAppProvider>
						</ThemeProvider>
					</QueryProvider>
				</SingleTabElectionGate>
			</BrowserTabLeaderProvider>
		</AppErrorBoundary>
	);
};

export default App;
