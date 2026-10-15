/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Critical-path tests for the top-level SPA router shell.
 *
 * Invariants:
 * - Desktop route test mocks the lazy DesktopWorkspace module and waits for Suspense to resolve.
 *
 * Related:
 * - src/components/AppRouter.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '../AppRouter';
import type { OidcRuntimeProfile } from '@/services/keycloakProfile';

const hoisted = vi.hoisted(() => ({
	beginInteractiveLogin: vi.fn(),
	hasExplicitLogoutPending: vi.fn(() => false),
	hasSessionReplacedPending: vi.fn(() => false),
	markSessionReplaceConfirmedWindow: vi.fn(),
	isAuthSessionAuthenticated: vi.fn(() => false),
	getOidcRuntimeProfile: vi.fn((): OidcRuntimeProfile => 'web'),
}));

const theme = {
	primary: '#3B82F6',
	secondary: '#8B5CF6',
	background: 'linear-gradient(135deg, #1e293b, #334155, #475569)',
	surface: '#1e293b',
	text: '#f8fafc',
	accent: '#10b981',
	success: '#22c55e',
	warning: '#f59e0b',
	error: '#ef4444',
	info: '#06b6d4',
};

const settings = {
	theme: 'dark' as const,
	language: 'ru' as const,
	notifications: true,
	animations: true,
	autoSave: true,
	compactMode: false,
	developerMode: false,
	performanceMode: false,
};

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	};
});

vi.mock('../../utils/authRedirect', () => ({
	beginInteractiveLogin: hoisted.beginInteractiveLogin,
	hasAuthCallbackFailed: () => false,
	hasSessionReplacedPending: hoisted.hasSessionReplacedPending,
	isInteractiveLoginInFlight: () => false,
	clearAuthCallbackFailed: vi.fn(),
	clearExplicitLogoutPending: vi.fn(),
	clearSessionReplacedPending: vi.fn(),
	hasExplicitLogoutPending: hoisted.hasExplicitLogoutPending,
	AUTH_AUTO_LOGIN_ATTEMPTED_SESSION_KEY: 'eliteew.login.autoAttempted.v1',
}));

vi.mock('../../services/auth/ssoSessionReplaceConfirm', () => ({
	markSessionReplaceConfirmedWindow: hoisted.markSessionReplaceConfirmedWindow,
	SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS: 15 * 60_000,
}));

vi.mock('../../services/keycloak', () => ({
	hasPendingAuthorizationCallbackInUrl: () => false,
	isAuthenticated: hoisted.isAuthSessionAuthenticated,
}));

vi.mock('../../services/keycloakProfile', () => ({
	getOidcRuntimeProfile: hoisted.getOidcRuntimeProfile,
}));

vi.mock('../../utils/lazyLoadWithErrorHandling', () => ({
	lazyWithErrorHandling: (_loader: unknown, componentName: string) => {
		const MockLazyComponent = () => (
			<div data-testid={`${componentName.toLowerCase()}-mock`}>
				{componentName}
			</div>
		);
		return MockLazyComponent;
	},
}));

describe('AppRouter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		hoisted.hasSessionReplacedPending.mockReturnValue(false);
		hoisted.hasExplicitLogoutPending.mockReturnValue(false);
		hoisted.isAuthSessionAuthenticated.mockReturnValue(false);
		hoisted.getOidcRuntimeProfile.mockReturnValue('web');
		sessionStorage.clear();
	});

	it('renders desktop shell outlet when currentPage is desktop (authenticated)', async () => {
		render(
			<AppRouter
				currentPage="desktop"
				isAuthenticated
				isAuthLoading={false}
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);
		expect(
			await screen.findByTestId('desktopworkspace-mock')
		).toBeInTheDocument();
	});

	it('keeps desktop workspace unmounted while authenticated auth is still resolving', () => {
		render(
			<AppRouter
				currentPage="desktop"
				isAuthenticated
				isAuthLoading
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);

		expect(screen.queryByTestId('desktopworkspace-mock')).toBeNull();
		expect(
			screen.getByRole('status', { name: 'workspace.openingDesktop' })
		).toBeInTheDocument();
	});

	it('shows login fallback on desktop when unauthenticated even while auth loading', () => {
		sessionStorage.setItem('eliteew.login.autoAttempted.v1', '1');
		render(
			<AppRouter
				currentPage="desktop"
				isAuthenticated={false}
				isAuthLoading
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);

		expect(screen.queryByTestId('desktopworkspace-mock')).toBeNull();
		expect(
			screen.queryByRole('status', { name: 'workspace.openingDesktop' })
		).toBeNull();
		expect(
			screen.getByRole('button', { name: 'loginFallback.signIn' })
		).toBeInTheDocument();
	});

	it('shows login fallback on desktop route when auth redirect did not leave the page', () => {
		sessionStorage.setItem('eliteew.login.autoAttempted.v1', '1');
		render(
			<AppRouter
				currentPage="desktop"
				isAuthenticated={false}
				isAuthLoading={false}
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);

		expect(screen.queryByTestId('desktopworkspace-mock')).toBeNull();
		expect(
			screen.getByRole('button', { name: 'loginFallback.signIn' })
		).toBeInTheDocument();
		expect(document.querySelector('.eliteew-login-fallback')).toBeTruthy();
	});

	it('shows login shell when on login and not authenticated', () => {
		sessionStorage.setItem('eliteew.login.autoAttempted.v1', '1');
		render(
			<AppRouter
				currentPage="login"
				isAuthenticated={false}
				isAuthLoading={false}
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);
		expect(
			screen.getByRole('button', { name: 'loginFallback.signIn' })
		).toBeInTheDocument();
		expect(document.querySelector('.eliteew-login-fallback')).toBeTruthy();
	});

	it('shows connecting status during auto SSO attempt', () => {
		render(
			<AppRouter
				currentPage="desktop"
				isAuthenticated={false}
				isAuthLoading={false}
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);

		expect(hoisted.markSessionReplaceConfirmedWindow).toHaveBeenCalledWith(
			15 * 60_000
		);
		expect(hoisted.beginInteractiveLogin).toHaveBeenCalledTimes(1);
		expect(screen.getByText('loginFallback.connecting')).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'loginFallback.signIn' })
		).toBeNull();
	});

	it('does not restart auto SSO after parent re-render when guard key is set', () => {
		const props = {
			currentPage: 'desktop' as const,
			isAuthenticated: false,
			isAuthLoading: false,
			user: null,
			onPageChange: vi.fn(),
			onUserUpdate: vi.fn(),
			theme,
			settings,
		};
		const { rerender } = render(<AppRouter {...props} />);
		expect(hoisted.beginInteractiveLogin).toHaveBeenCalledTimes(1);
		rerender(<AppRouter {...props} />);
		expect(hoisted.beginInteractiveLogin).toHaveBeenCalledTimes(1);
	});

	it('waits for AuthContext when OIDC facade already has a session', () => {
		hoisted.isAuthSessionAuthenticated.mockReturnValue(true);
		render(
			<AppRouter
				currentPage="desktop"
				isAuthenticated={false}
				isAuthLoading={false}
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);

		expect(hoisted.beginInteractiveLogin).not.toHaveBeenCalled();
		expect(hoisted.markSessionReplaceConfirmedWindow).not.toHaveBeenCalled();
		expect(screen.getByText('loginFallback.connecting')).toBeInTheDocument();
	});

	it('does not auto-start SSO after explicit logout pending', () => {
		hoisted.hasExplicitLogoutPending.mockReturnValue(true);
		render(
			<AppRouter
				currentPage="desktop"
				isAuthenticated={false}
				isAuthLoading={false}
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);

		expect(hoisted.beginInteractiveLogin).not.toHaveBeenCalled();
		expect(hoisted.markSessionReplaceConfirmedWindow).not.toHaveBeenCalled();
	});

	it('shows closing status without sign-in CTA in desktopNative product WebView after explicit logout', () => {
		hoisted.getOidcRuntimeProfile.mockReturnValue('desktopNative');
		hoisted.hasExplicitLogoutPending.mockReturnValue(true);
		render(
			<AppRouter
				currentPage="desktop"
				isAuthenticated={false}
				isAuthLoading={false}
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);

		expect(
			screen.getByText('loginFallback.desktopClosing')
		).toBeInTheDocument();
		expect(screen.queryByText('loginFallback.signIn')).not.toBeInTheDocument();
		expect(hoisted.beginInteractiveLogin).not.toHaveBeenCalled();
	});

	it('desktopNative Start without logout pending keeps auto-SSO, not closing status', () => {
		hoisted.getOidcRuntimeProfile.mockReturnValue('desktopNative');
		hoisted.hasExplicitLogoutPending.mockReturnValue(false);
		render(
			<AppRouter
				currentPage="desktop"
				isAuthenticated={false}
				isAuthLoading={false}
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);

		expect(
			screen.queryByText('loginFallback.desktopClosing')
		).not.toBeInTheDocument();
		expect(hoisted.beginInteractiveLogin).toHaveBeenCalledTimes(1);
		expect(screen.getByText('loginFallback.connecting')).toBeInTheDocument();
	});

	it('marks replace confirmation window before manual SSO from session-replaced fallback', () => {
		hoisted.hasSessionReplacedPending.mockReturnValue(true);
		render(
			<AppRouter
				currentPage="desktop"
				isAuthenticated={false}
				isAuthLoading={false}
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'loginFallback.signIn' })
		);

		expect(hoisted.markSessionReplaceConfirmedWindow).toHaveBeenCalledWith(
			15 * 60_000
		);
		expect(hoisted.beginInteractiveLogin).toHaveBeenCalledWith('manual_login', {
			persistSession: false,
			forceFreshAuth: true,
		});
	});

	it('marks OAuth replace confirmation before ordinary manual SSO click', () => {
		sessionStorage.setItem('eliteew.login.autoAttempted.v1', '1');
		render(
			<AppRouter
				currentPage="desktop"
				isAuthenticated={false}
				isAuthLoading={false}
				user={null}
				onPageChange={vi.fn()}
				onUserUpdate={vi.fn()}
				theme={theme}
				settings={settings}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'loginFallback.signIn' })
		);

		expect(hoisted.markSessionReplaceConfirmedWindow).toHaveBeenCalledWith(
			15 * 60_000
		);
		expect(hoisted.beginInteractiveLogin).toHaveBeenCalledWith('manual_login', {
			persistSession: false,
			forceFreshAuth: false,
		});
	});
});
