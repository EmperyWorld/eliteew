/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source-level lock: cold `#desktop` callers await shared shell-bootstrap before
 * their own GETs; DesktopWorkspace gates GAF/Content until hydrate settles.
 *
 * Related:
 * - pages/Desktop/services/desktopShellBootstrap.ts
 * - documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FRONTEND_SRC = resolve(__dirname, '../../../..');

function readSrc(relFromSrc: string): string {
	return readFileSync(resolve(FRONTEND_SRC, relFromSrc), 'utf8');
}

describe('desktopShellBootstrap await invariant (source)', () => {
	it('Auth / Preferences / NotificationCenter / Voice await ensure before cold GET', () => {
		const auth = readSrc('contexts/AuthContext.tsx');
		const prefs = readSrc('contexts/UserPreferencesAppContext.tsx');
		const notif = readSrc('notifications/NotificationCenterSync.tsx');
		const voice = readSrc('voice-core/VoiceSettingsContext.tsx');

		for (const [name, src] of [
			['AuthContext', auth],
			['UserPreferencesAppContext', prefs],
			['NotificationCenterSync', notif],
			['VoiceSettingsContext', voice],
		] as const) {
			expect(src, name).toMatch(/await ensureDesktopShellBootstrap\(/);
		}

		expect(auth.indexOf('await ensureDesktopShellBootstrap()')).toBeLessThan(
			auth.indexOf('queryClient.fetchQuery')
		);
		expect(prefs.indexOf('await ensureDesktopShellBootstrap()')).toBeLessThan(
			prefs.indexOf('queryClient.fetchQuery')
		);
		expect(notif.indexOf('await ensureDesktopShellBootstrap()')).toBeLessThan(
			notif.indexOf('queryClient.fetchQuery')
		);
		expect(voice.indexOf('await ensureDesktopShellBootstrap()')).toBeLessThan(
			voice.indexOf('apiClient.get<VoiceSettingsApi>')
		);
	});

	it('DesktopWorkspace gates GAFChatProvider behind shellBootstrapReady', () => {
		const workspace = readSrc('pages/Desktop/DesktopWorkspace.tsx');
		expect(workspace).toContain(
			'ensureDesktopShellBootstrap({ forceDesktop: true })'
		);
		expect(workspace).toContain('shellBootstrapReady');
		expect(workspace).toMatch(/!shellBootstrapReady\s*\?/);
		expect(workspace).toContain('<GAFChatProvider>');
		expect(workspace.indexOf('!shellBootstrapReady')).toBeLessThan(
			workspace.indexOf('<GAFChatProvider>')
		);
	});

	it('App.tsx does not kick a parallel ensureDesktopShellBootstrap', () => {
		const app = readSrc('App.tsx');
		expect(app).not.toMatch(/ensureDesktopShellBootstrap\s*\(/);
	});

	it('Auth clears shell-bootstrap only after real logout (hadAuthenticatedRef)', () => {
		const auth = readSrc('contexts/AuthContext.tsx');
		expect(auth).toContain('clearDesktopShellBootstrapCache');
		const clearIdx = auth.indexOf('clearDesktopShellBootstrapCache');
		const blockStart = auth.lastIndexOf('if (!isAuthenticated)', clearIdx);
		expect(blockStart).toBeGreaterThan(-1);
		const gate = auth.slice(blockStart, clearIdx);
		expect(gate).toContain('hadAuthenticatedRef.current');
		expect(gate).not.toMatch(/!token/);
	});

	it('GAF me queryOptions carry staleTime so bootstrap seed is not immediately stale', () => {
		const opts = readSrc(
			'pages/Desktop/components/GAFChat/gafChatQueryOptions.ts'
		);
		expect(opts).toContain('GAF_CHAT_ME_STALE_MS');
		expect(opts).toMatch(/staleTime:\s*GAF_CHAT_ME_STALE_MS/);
	});

	it('GAF socket handlers skip chats refetch on initial connection-restored', () => {
		const provider = readSrc('pages/Desktop/context/GAFChatProvider.tsx');
		expect(provider).toContain('useGafChatSocketEventHandlers');
		const handlers = readSrc(
			'pages/Desktop/context/useGafChatSocketEventHandlers.ts'
		);
		expect(handlers).toContain('shouldRefetchGafChatsOnConnectionRestored');
		expect(handlers).toMatch(
			/if\s*\(\s*!shouldRefetchGafChatsOnConnectionRestored\(payload\)\s*\)/
		);
	});
});
