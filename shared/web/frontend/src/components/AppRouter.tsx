/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Верхнеуровневая маршрутизация desktop-only shell. Полноэкранные продуктовые страницы перенесены в окна
 * Безраздельного мира; login fallback использует тот же SPA PKCE-flow, что и автоматический auth gate.
 *
 * Invariants:
 * - Web login не должен идти через legacy `/oauth2/start`; единый источник — `beginInteractiveLogin`.
 * - Continuity W2: SPA «remember» checkbox is browser token persistence only
 *   (`localStorage` vs `sessionStorage`); Keycloak form owns IdP Remember Me.
 * - Continuity W3: terminal idle/max → session-ended surface (no auto-PKCE);
 *   session_replaced stays a separate pending path.
 * - `LoginPageFallback` arms `X-SSO-Replace-Confirm` (OAuth TTL) before auto and manual PKCE so the
 *   first callback can replace a stale browser sid in `sso_user_sessions`.
 * - Desktop/FoFline product WebView (`desktopNative` / `foflineNative`) shows closing status
 *   instead of the sign-in form only while `hasExplicitLogoutPending()`; a fresh Start WebView
 *   keeps living PKCE / the sign-in card.
 * - Full `desktopUi` and DesktopWorkspace resolve at one route-local boundary.
 * - Hash/currentPage синхронизацией управляет `App.tsx` / `pageRouting`, не локальный router state.
 *
 * Related:
 * - `App.tsx`, `utils/authRedirect.ts`, `utils/pageRouting.ts`
 * - `services/auth/ssoSessionReplaceConfirm.ts`, `documentation/product/FRONTEND-AUTH.md`
 */

import {
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { EliteBootLoadingScreen } from '@/components/ui/EliteBootLoadingScreen';
import { MobileEmbeddedRouteLoading } from '@/components/mobileEmbedded/MobileEmbeddedRouteLoading';
import { getPageLabel } from '../config/pageNavigation';
import type {
	AppSettings,
	AppTheme,
	ShellPageType,
} from '../hooks/useAppState';
import type { User } from '../services';
import type { NavigationHandler } from '../types/navigation';
import { announceToScreenReader } from '../utils/accessibility';
import {
	AUTH_AUTO_LOGIN_ATTEMPTED_SESSION_KEY,
	beginInteractiveLogin,
	clearAuthCallbackFailed,
	clearExplicitLogoutPending,
	clearSessionEndedPending,
	clearSessionReplacedPending,
	hasAuthCallbackFailed,
	hasExplicitLogoutPending,
	hasSessionEndedPending,
	hasSessionReplacedPending,
	isInteractiveLoginInFlight,
	readSessionEndedMeta,
} from '../utils/authRedirect';
import {
	hasPendingAuthorizationCallbackInUrl,
	isAuthenticated as isAuthSessionAuthenticated,
} from '../services/keycloak';
import { getOidcRuntimeProfile } from '../services/keycloakProfile';
import {
	markSessionReplaceConfirmedWindow,
	SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS,
} from '../services/auth/ssoSessionReplaceConfirm';
import { lazyWithErrorHandling } from '../utils/lazyLoadWithErrorHandling';
import './AppRouter.css';

function isDesktopProductWebViewLogoutShell(): boolean {
	const profile = getOidcRuntimeProfile();
	return profile === 'desktopNative' || profile === 'foflineNative';
}
const LOGIN_REMEMBER_ME_PREF_KEY = 'eliteew.login.rememberMePref.v1';

function readRememberMePreference(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return sessionStorage.getItem(LOGIN_REMEMBER_ME_PREF_KEY) === '1';
	} catch {
		return false;
	}
}

function persistRememberMePreference(rememberMe: boolean): void {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.setItem(LOGIN_REMEMBER_ME_PREF_KEY, rememberMe ? '1' : '0');
	} catch {
		// ignore
	}
}

const DesktopWorkspace = lazyWithErrorHandling(async () => {
	const [{ ensureDesktopUiReady }, workspaceModule] = await Promise.all([
		import('../i18n/config'),
		import('../pages/Desktop/DesktopWorkspace'),
	]);
	await ensureDesktopUiReady();
	return workspaceModule;
}, 'DesktopWorkspace');

const MobileAppDownloadPage = lazyWithErrorHandling(
	() => import('../pages/MobileAppDownloadPage'),
	'MobileAppDownloadPage'
);

const MobileEwaCompanionPage = lazyWithErrorHandling(
	() => import('../pages/MobileEwaCompanion/MobileEwaCompanionPage'),
	'MobileEwaCompanionPage'
);

const MobileHandbookPage = lazyWithErrorHandling(
	() => import('../pages/MobileHandbook/MobileHandbookPage'),
	'MobileHandbookPage'
);

const MobileSocialHubPage = lazyWithErrorHandling(
	() => import('../pages/MobileSocialHub/MobileSocialHubPage'),
	'MobileSocialHubPage'
);

const MobileFeedbackHubPage = lazyWithErrorHandling(
	() => import('../pages/MobileFeedbackHub/MobileFeedbackHubPage'),
	'MobileFeedbackHubPage'
);

const MobileNotificationsPage = lazyWithErrorHandling(
	() => import('../pages/MobileNotifications/MobileNotificationsPage'),
	'MobileNotificationsPage'
);

const MobileContentManagerPage = lazyWithErrorHandling(
	() => import('../pages/MobileContentManager/MobileContentManagerPage'),
	'MobileContentManagerPage'
);

const MobileEwDeskPage = lazyWithErrorHandling(
	() => import('../pages/MobileEwDesk/MobileEwDeskPage'),
	'MobileEwDeskPage'
);

const MobileProfessionalWorldsPage = lazyWithErrorHandling(
	() =>
		import('../pages/MobileProfessionalWorlds/MobileProfessionalWorldsPage'),
	'MobileProfessionalWorldsPage'
);

const MobileAppStorePage = lazyWithErrorHandling(
	() => import('../pages/MobileAppStore/MobileAppStorePage'),
	'MobileAppStorePage'
);

const MobileDesktopSettingsPage = lazyWithErrorHandling(
	() => import('../pages/MobileDesktopSettings/MobileDesktopSettingsPage'),
	'MobileDesktopSettingsPage'
);

const EmperyNexusChroniclePage = lazyWithErrorHandling(
	() =>
		import('../features/empery-nexus-chronicle/EmperyNexusChroniclePage').then(
			(m) => ({ default: m.EmperyNexusChroniclePage })
		),
	'EmperyNexusChroniclePage'
);

const UnifiedAdminPage = lazyWithErrorHandling(
	() =>
		import('../pages/Admin/UnifiedAdminPage').then((m) => ({
			default: m.UnifiedAdminPage,
		})),
	'UnifiedAdminPage'
);

const AdvancedLoadingScreen: React.FC<{ message?: string }> = ({
	message = 'Загрузка...',
}) => <EliteBootLoadingScreen message={message} />;

const DesktopRouteLoadingFallback: React.FC = () => {
	const { t } = useTranslation('desktopUi');
	return <EliteBootLoadingScreen message={t('workspace.openingDesktop')} />;
};

function LoginPageContainer({ children }: { children: ReactNode }) {
	return (
		<div className="login-page-container flex items-center justify-center">
			{children}
		</div>
	);
}

function AppRouterOutletShell({ children }: { children: ReactNode }) {
	return (
		<div
			className="ew-router-outlet relative isolate flex min-h-0 w-full flex-1 flex-col"
			data-app-router-outlet
		>
			{children}
		</div>
	);
}

interface AppRouterProps {
	currentPage: ShellPageType;
	isAuthenticated: boolean;
	/** Синхронизируется с AuthContext.loading в App.tsx */
	isAuthLoading: boolean;
	user: User | null;
	onPageChange: NavigationHandler;
	onUserUpdate: (user: User) => void;
	theme: AppTheme;
	settings: AppSettings;
}

export const AppRouter: React.FC<AppRouterProps> = ({
	currentPage,
	isAuthenticated,
	isAuthLoading,
	user: _user,
	onPageChange,
	onUserUpdate: _onUserUpdate,
	theme: _theme,
	settings: _settings,
}: AppRouterProps): React.JSX.Element | null => {
	useEffect(() => {
		const label = getPageLabel(currentPage);
		announceToScreenReader(`Страница: ${label}`, 'polite');
	}, [currentPage]);

	const handleBeginInteractiveLogin = useCallback(
		(persistSession: boolean, forceFreshAuth?: boolean) => {
			beginInteractiveLogin('manual_login', {
				persistSession,
				forceFreshAuth,
			});
		},
		[]
	);

	const renderDesktopWorkspace = (): React.JSX.Element => {
		// Bounded OIDC bootstrap already completed — unauthenticated users must reach
		// LoginPageFallback (auto-SSO / manual sign-in), not an eternal desktop loader.
		if (!isAuthenticated) {
			return <LoginPageFallback onBeginLogin={handleBeginInteractiveLogin} />;
		}
		if (isAuthLoading) {
			return <DesktopRouteLoadingFallback />;
		}
		return (
			<Suspense fallback={<DesktopRouteLoadingFallback />}>
				<DesktopWorkspace />
			</Suspense>
		);
	};

	const outlet: ReactNode = (() => {
		switch (currentPage) {
			case 'desktop':
			case 'desktop/store':
				return renderDesktopWorkspace();

			case 'desktop-admin':
				return (
					<Suspense
						fallback={
							<AdvancedLoadingScreen message="Загрузка админ-панели..." />
						}
					>
						<UnifiedAdminPage
							onNavigate={onPageChange}
							initialSection="users"
						/>
					</Suspense>
				);

			case 'admin':
				return (
					<Suspense
						fallback={
							<AdvancedLoadingScreen message="Загрузка админ-панели..." />
						}
					>
						<UnifiedAdminPage
							onNavigate={onPageChange}
							initialSection="users"
						/>
					</Suspense>
				);

			case 'login':
				if (isAuthenticated) {
					onPageChange('desktop');
					return null;
				}

				return <LoginPageFallback onBeginLogin={handleBeginInteractiveLogin} />;

			case 'mobile-app-download':
				return (
					<Suspense fallback={<AdvancedLoadingScreen message="Загрузка…" />}>
						<MobileAppDownloadPage />
					</Suspense>
				);

			case 'mobile-ewa-companion':
				return (
					<Suspense
						fallback={<MobileEmbeddedRouteLoading message="Открываем EWA…" />}
					>
						<MobileEwaCompanionPage />
					</Suspense>
				);

			case 'mobile-handbook':
				return (
					<Suspense
						fallback={
							<MobileEmbeddedRouteLoading message="Открываем справочник…" />
						}
					>
						<MobileHandbookPage />
					</Suspense>
				);

			case 'mobile-social-hub':
				return (
					<Suspense
						fallback={
							<MobileEmbeddedRouteLoading message="Открываем Social Hub…" />
						}
					>
						<MobileSocialHubPage />
					</Suspense>
				);

			case 'mobile-feedback-hub':
				return (
					<Suspense
						fallback={
							<MobileEmbeddedRouteLoading message="Открываем обращения…" />
						}
					>
						<MobileFeedbackHubPage />
					</Suspense>
				);

			case 'mobile-notifications':
				return (
					<Suspense
						fallback={
							<MobileEmbeddedRouteLoading message="Открываем центр уведомлений…" />
						}
					>
						<MobileNotificationsPage />
					</Suspense>
				);

			case 'mobile-content-manager':
				return (
					<Suspense
						fallback={
							<MobileEmbeddedRouteLoading message="Открываем файловый менеджер…" />
						}
					>
						<MobileContentManagerPage />
					</Suspense>
				);

			case 'mobile-ewdesk':
				return (
					<Suspense
						fallback={
							<MobileEmbeddedRouteLoading message="Открываем EWDesk…" />
						}
					>
						<MobileEwDeskPage />
					</Suspense>
				);

			case 'mobile-professional-worlds':
				return (
					<Suspense
						fallback={
							<MobileEmbeddedRouteLoading message="Открываем Professional Worlds…" />
						}
					>
						<MobileProfessionalWorldsPage />
					</Suspense>
				);

			case 'mobile-app-store':
				return (
					<Suspense
						fallback={
							<MobileEmbeddedRouteLoading message="Открываем магазин приложений…" />
						}
					>
						<MobileAppStorePage />
					</Suspense>
				);

			case 'mobile-desktop-settings':
				return (
					<Suspense
						fallback={
							<MobileEmbeddedRouteLoading message="Открываем настройки рабочего стола…" />
						}
					>
						<MobileDesktopSettingsPage />
					</Suspense>
				);

			case 'empery-nexus': {
				if (!isAuthenticated) {
					return (
						<LoginPageFallback onBeginLogin={handleBeginInteractiveLogin} />
					);
				}
				if (isAuthLoading) {
					return <AdvancedLoadingScreen message="Открываем Empery Nexus…" />;
				}
				return (
					<Suspense
						fallback={
							<AdvancedLoadingScreen message="Загрузка хроники Empery Nexus…" />
						}
					>
						<EmperyNexusChroniclePage onNavigate={onPageChange} />
					</Suspense>
				);
			}

			default:
				return renderDesktopWorkspace();
		}
	})();

	return <AppRouterOutletShell>{outlet}</AppRouterOutletShell>;
};

function LoginPageFallback({
	onBeginLogin,
}: {
	onBeginLogin: (persistSession: boolean, forceFreshAuth?: boolean) => void;
}) {
	const { t } = useTranslation('desktopUi');
	const [rememberMe, setRememberMe] = useState(readRememberMePreference);
	const [autoConnecting, setAutoConnecting] = useState(false);
	const callbackFailed = hasAuthCallbackFailed();
	const sessionReplacedPending = hasSessionReplacedPending();
	const sessionEndedPending = hasSessionEndedPending();
	const sessionEndedMeta = sessionEndedPending ? readSessionEndedMeta() : null;
	const onBeginLoginRef = useRef(onBeginLogin);
	onBeginLoginRef.current = onBeginLogin;
	const facadeAuthenticated = isAuthSessionAuthenticated();
	const desktopProductLogoutShell =
		isDesktopProductWebViewLogoutShell() && hasExplicitLogoutPending();

	useEffect(() => {
		if (desktopProductLogoutShell) return;
		if (callbackFailed || sessionReplacedPending || sessionEndedPending) return;
		if (hasExplicitLogoutPending()) return;
		if (hasPendingAuthorizationCallbackInUrl()) return;
		if (isInteractiveLoginInFlight()) return;
		// OIDC callback already applied tokens — wait for AuthContext sync, do not restart PKCE.
		if (isAuthSessionAuthenticated()) {
			setAutoConnecting(true);
			return;
		}
		try {
			if (sessionStorage.getItem(AUTH_AUTO_LOGIN_ATTEMPTED_SESSION_KEY)) {
				return;
			}
			sessionStorage.setItem(AUTH_AUTO_LOGIN_ATTEMPTED_SESSION_KEY, '1');
		} catch {
			return;
		}
		setAutoConnecting(true);
		// Prior browser sid in SSO registry needs confirm on first PKCE — arm before redirect.
		markSessionReplaceConfirmedWindow(SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS);
		onBeginLoginRef.current(readRememberMePreference(), false);
	}, [
		callbackFailed,
		sessionReplacedPending,
		sessionEndedPending,
		desktopProductLogoutShell,
	]);

	if (desktopProductLogoutShell) {
		return (
			<LoginPageContainer>
				<div className="eliteew-login-fallback">
					<header className="eliteew-login-fallback__brand">
						<span className="eliteew-login-fallback__mark">EW</span>
						<span className="eliteew-login-fallback__wordmark">
							{t('loginFallback.title')}
						</span>
					</header>
					<div className="eliteew-login-fallback__card">
						<p className="eliteew-login-fallback__notice" role="status">
							{t('loginFallback.desktopClosing')}
						</p>
					</div>
				</div>
			</LoginPageContainer>
		);
	}

	const showConnectingOnly =
		(autoConnecting || facadeAuthenticated) &&
		!callbackFailed &&
		!sessionReplacedPending &&
		!sessionEndedPending;

	if (showConnectingOnly) {
		return (
			<LoginPageContainer>
				<div className="eliteew-login-fallback">
					<header className="eliteew-login-fallback__brand">
						<span className="eliteew-login-fallback__mark">EW</span>
						<span className="eliteew-login-fallback__wordmark">
							{t('loginFallback.title')}
						</span>
					</header>
					<div className="eliteew-login-fallback__card">
						<p className="eliteew-login-fallback__notice" role="status">
							{t('loginFallback.connecting')}
						</p>
					</div>
				</div>
			</LoginPageContainer>
		);
	}

	return (
		<LoginPageContainer>
			<div className="eliteew-login-fallback">
				<header className="eliteew-login-fallback__brand">
					<span className="eliteew-login-fallback__mark">EW</span>
					<span className="eliteew-login-fallback__wordmark">
						{t('loginFallback.title')}
					</span>
				</header>
				<div className="eliteew-login-fallback__card">
					<h1 className="eliteew-login-fallback__title">
						{sessionEndedPending
							? t('loginFallback.sessionEndedHeading')
							: t('loginFallback.heading')}
					</h1>
					{sessionEndedPending ? (
						<p className="eliteew-login-fallback__notice" role="status">
							{sessionEndedMeta?.kind === 'reuse_detected'
								? sessionEndedMeta.preserved
									? t('loginFallback.sessionEndedReusePreserved')
									: t('loginFallback.sessionEndedReuse')
								: sessionEndedMeta?.preserved
									? t('loginFallback.sessionEndedPreserved')
									: t('loginFallback.sessionEnded')}
						</p>
					) : null}
					{sessionReplacedPending ? (
						<p className="eliteew-login-fallback__notice" role="status">
							{t('sessionAuth.sessionReplaced')}
						</p>
					) : null}
					{callbackFailed ? (
						<p className="eliteew-login-fallback__notice" role="status">
							{t('loginFallback.callbackFailed')}
						</p>
					) : null}
					<label className="eliteew-login-fallback__remember">
						<input
							type="checkbox"
							checked={rememberMe}
							aria-describedby="eliteew-login-fallback-remember-hint"
							onChange={(event) => {
								const next = event.target.checked;
								setRememberMe(next);
								persistRememberMePreference(next);
							}}
						/>
						{t('loginFallback.rememberMe')}
					</label>
					<button
						type="button"
						className="eliteew-login-fallback__submit"
						onClick={(): void => {
							const needsFreshAuth = sessionReplacedPending || callbackFailed;
							markSessionReplaceConfirmedWindow(
								SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS
							);
							clearAuthCallbackFailed();
							clearSessionReplacedPending();
							clearSessionEndedPending();
							clearExplicitLogoutPending();
							onBeginLogin(rememberMe, needsFreshAuth);
						}}
					>
						{t('loginFallback.signIn')}
					</button>
					{!sessionEndedPending ? (
						<p className="eliteew-login-fallback__meta">
							{t('loginFallback.alreadySignedIn')}{' '}
							<button
								type="button"
								onClick={(): void => {
									window.location.reload();
								}}
							>
								{t('loginFallback.refreshPage')}
							</button>
						</p>
					) : null}
					<p
						id="eliteew-login-fallback-remember-hint"
						className="eliteew-login-fallback__hint"
					>
						{t('loginFallback.rememberMeHint')}
					</p>
				</div>
			</div>
		</LoginPageContainer>
	);
}
