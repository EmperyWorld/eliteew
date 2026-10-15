/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop/FoFline product logout must not redirect to Keycloak login.
 *
 * Related:
 * - services/keycloakOidcLogoutFlow.ts
 * - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { oidcLogout } from '../keycloakOidcLogoutFlow';
import { setOidcRuntimeProfile } from '../keycloakProfile';
import type { AuthOidcSessionHost } from '../keycloakOidcSessionShared';

function hostStub(assignable: {
	clearSession: ReturnType<typeof vi.fn>;
	getAuthorizationServer: ReturnType<typeof vi.fn>;
}): AuthOidcSessionHost {
	const stub = {
		oidcInteractiveRedirectInFlight: false,
		tokenPersistence: 'session' as const,
		idToken: 'id-hint',
		clearSession: assignable.clearSession,
		getAuthorizationServer: assignable.getAuthorizationServer,
	};
	return stub as unknown as AuthOidcSessionHost;
}

describe('oidcLogout desktop product WebView', () => {
	const assignMock = vi.fn();
	const clearSession = vi.fn();
	const getAuthorizationServer = vi.fn(async () => ({
		end_session_endpoint:
			'https://auth.eliteew.ru/realms/empery/protocol/openid-connect/logout',
	}));

	beforeEach(() => {
		assignMock.mockReset();
		clearSession.mockReset();
		getAuthorizationServer.mockClear();
		vi.stubGlobal('location', {
			assign: assignMock,
			href: 'https://app.eliteew.ru/?eliteewDesktopClient=1',
			protocol: 'https:',
			origin: 'https://app.eliteew.ru',
			host: 'app.eliteew.ru',
			hostname: 'app.eliteew.ru',
			pathname: '/',
			search: '?eliteewDesktopClient=1',
			hash: '',
		});
	});

	afterEach(() => {
		setOidcRuntimeProfile('web');
		vi.unstubAllGlobals();
	});

	it('desktopNative skips Keycloak end_session redirect', async () => {
		setOidcRuntimeProfile('desktopNative');
		await oidcLogout(hostStub({ clearSession, getAuthorizationServer }));
		expect(clearSession).toHaveBeenCalledWith(true, true);
		expect(assignMock).not.toHaveBeenCalled();
		expect(getAuthorizationServer).not.toHaveBeenCalled();
	});

	it('foflineNative skips Keycloak end_session redirect', async () => {
		setOidcRuntimeProfile('foflineNative');
		await oidcLogout(hostStub({ clearSession, getAuthorizationServer }));
		expect(assignMock).not.toHaveBeenCalled();
	});

	it('web profile still assigns Keycloak end_session', async () => {
		setOidcRuntimeProfile('web');
		await oidcLogout(hostStub({ clearSession, getAuthorizationServer }));
		expect(assignMock).toHaveBeenCalledTimes(1);
		expect(String(assignMock.mock.calls[0]?.[0])).toContain(
			'/protocol/openid-connect/logout'
		);
	});
});
