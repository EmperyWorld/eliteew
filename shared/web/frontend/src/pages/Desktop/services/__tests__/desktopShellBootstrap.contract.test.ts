/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for desktop shell-bootstrap hydrate — seeds profile RQ keys and
 * skips HTTP when cache already warm.
 *
 * Related:
 * - pages/Desktop/services/desktopShellBootstrap.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
const publishMaintenanceStatus = vi.fn();
const setQueryData = vi.fn();

vi.mock('@/services/api/client', () => ({
	api: {
		get: (...args: unknown[]) => apiGet(...args),
	},
	createAPIClient: () => ({
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn(),
	}),
	APIError: class APIError extends Error {
		statusCode: number;
		constructor(message: string, statusCode = 500) {
			super(message);
			this.statusCode = statusCode;
		}
	},
}));

vi.mock('@/services/api/ugs/dashboard', () => ({
	fetchUgsTraySummary: vi.fn(),
}));

vi.mock('@/services/maintenance/maintenanceState', () => ({
	publishMaintenanceStatus: (...args: unknown[]) =>
		publishMaintenanceStatus(...args),
}));

vi.mock('@/providers/QueryProvider', () => ({
	queryClient: {
		setQueryData: (...args: unknown[]) => setQueryData(...args),
	},
}));

vi.mock('@/utils/logger', () => ({
	log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const seedDesktopShellStateFromBootstrap = vi.fn();
vi.mock('../desktopApi/shellState', () => ({
	seedDesktopShellStateFromBootstrap: (...args: unknown[]) =>
		seedDesktopShellStateFromBootstrap(...args),
}));

import {
	PROFILE_ME_QUERY_KEY,
	PROFILE_NOTIFICATION_CENTER_QUERY_KEY,
	PROFILE_PREFERENCES_QUERY_KEY,
} from '@/services/profileService';
import { gafChatQueryKeys } from '../../components/GAFChat/api/gafChatApi';
import {
	__setDesktopShellBootstrapForTests,
	clearDesktopShellBootstrapCache,
	ensureDesktopShellBootstrap,
	peekDesktopShellBootstrap,
	type DesktopShellBootstrapPayload,
} from '../desktopShellBootstrap';

function samplePayload(): DesktopShellBootstrapPayload {
	return {
		schema_version: 2,
		fetched_at: new Date().toISOString(),
		maintenance: { active: false, window: null } as never,
		profile: { id: 'u1', email: 'a@b.c', username: 'a' } as never,
		preferences: {} as never,
		notification_center: { items: [], updated_at: null, dismissed_ids: [] },
		desktop_config: {
			id: 'c1',
			user_id: 'u1',
			wallpaper: 'x',
			icon_size: 'medium',
			show_widget: false,
			widget_position: { x: 0, y: 0 },
			theme: 'dark',
		} as never,
		installed: { app_ids: ['app-store'] },
		shell_state: { recent_app_ids: ['app-store'] } as never,
		shell_state_etag: 'W/"shell"',
		shell_state_field_etags: { recent_app_ids: '"x"' },
		items: { items: [] },
		recent_files: [],
		recent_content_feed: {
			opened: [],
			added: [],
			generated: [],
			uploaded: [],
			projects: [],
		},
		gaf_me: { user_id: 'u1' },
		gaf_chats: [],
		friends_overview: null,
		ewdesk_news_counts: null,
		ewdesk_news_my_state: null,
		ugs_tray_summary: null,
	};
}

describe('desktopShellBootstrap', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearDesktopShellBootstrapCache();
		window.location.hash = '#desktop';
	});

	it('hydrates profile query keys from one bootstrap GET', async () => {
		const payload = samplePayload();
		apiGet.mockResolvedValueOnce(payload);

		const got = await ensureDesktopShellBootstrap({ forceDesktop: true });
		expect(got?.schema_version).toBe(2);
		expect(apiGet).toHaveBeenCalledTimes(1);
		expect(publishMaintenanceStatus).toHaveBeenCalledWith(payload.maintenance);
		expect(seedDesktopShellStateFromBootstrap).toHaveBeenCalledWith(
			payload.shell_state,
			payload.shell_state_etag,
			payload.shell_state_field_etags
		);
		expect(setQueryData).toHaveBeenCalledWith(
			PROFILE_ME_QUERY_KEY,
			payload.profile,
			expect.objectContaining({ updatedAt: expect.any(Number) })
		);
		expect(setQueryData).toHaveBeenCalledWith(
			PROFILE_PREFERENCES_QUERY_KEY,
			payload.preferences,
			expect.objectContaining({ updatedAt: expect.any(Number) })
		);
		expect(setQueryData).toHaveBeenCalledWith(
			PROFILE_NOTIFICATION_CENTER_QUERY_KEY,
			payload.notification_center,
			expect.objectContaining({ updatedAt: expect.any(Number) })
		);
	});

	it('single-flights and reuses cache (no second HTTP)', async () => {
		const payload = samplePayload();
		apiGet.mockResolvedValueOnce(payload);

		await ensureDesktopShellBootstrap({ forceDesktop: true });
		await ensureDesktopShellBootstrap({ forceDesktop: true });
		expect(apiGet).toHaveBeenCalledTimes(1);
		expect(peekDesktopShellBootstrap()?.gaf_me.user_id).toBe('u1');
	});

	it('skips network off desktop hash unless forceDesktop', async () => {
		window.location.hash = '#admin';
		const got = await ensureDesktopShellBootstrap();
		expect(got).toBeNull();
		expect(apiGet).not.toHaveBeenCalled();
	});

	it('test helper seeds without HTTP', () => {
		const payload = samplePayload();
		__setDesktopShellBootstrapForTests(payload);
		expect(peekDesktopShellBootstrap()).toBe(payload);
		expect(setQueryData).toHaveBeenCalled();
	});

	it('shouldAwaitDesktopShellBootstrap follows hash / forceDesktop', async () => {
		const { shouldAwaitDesktopShellBootstrap } = await import(
			'../desktopShellBootstrap'
		);
		window.location.hash = '#desktop';
		expect(shouldAwaitDesktopShellBootstrap()).toBe(true);
		window.location.hash = '#admin';
		expect(shouldAwaitDesktopShellBootstrap()).toBe(false);
		expect(shouldAwaitDesktopShellBootstrap(true)).toBe(true);
	});

	it('seeds empty gaf_chats array (not skipped as falsy)', async () => {
		const payload = samplePayload();
		payload.gaf_chats = [];
		apiGet.mockResolvedValueOnce(payload);

		await ensureDesktopShellBootstrap({ forceDesktop: true });
		expect(setQueryData).toHaveBeenCalledWith(
			gafChatQueryKeys.chats,
			[],
			expect.objectContaining({ updatedAt: expect.any(Number) })
		);
	});

	it('clear during flight discards hydrate and allows one fresh GET', async () => {
		let resolveFirst!: (v: DesktopShellBootstrapPayload) => void;
		apiGet.mockImplementationOnce(
			() =>
				new Promise<DesktopShellBootstrapPayload>((resolve) => {
					resolveFirst = resolve;
				})
		);

		const first = ensureDesktopShellBootstrap({ forceDesktop: true });
		clearDesktopShellBootstrapCache();
		apiGet.mockResolvedValueOnce(samplePayload());
		const second = ensureDesktopShellBootstrap({ forceDesktop: true });

		resolveFirst(samplePayload());
		await expect(first).resolves.toBeNull();
		await expect(second).resolves.toMatchObject({ schema_version: 2 });
		expect(apiGet).toHaveBeenCalledTimes(2);
		expect(peekDesktopShellBootstrap()?.schema_version).toBe(2);
	});
});
