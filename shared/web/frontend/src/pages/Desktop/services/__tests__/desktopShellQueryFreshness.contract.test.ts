/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock bootstrap-aligned React Query staleTime wiring for cold `#desktop`.
 *
 * Related:
 * - services/desktopShellQueryFreshness.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DESKTOP_SHELL_BOOTSTRAP_STALE_MS,
	DESKTOP_SHELL_GAF_CHATS_STALE_MS,
	DESKTOP_SHELL_STORE_CATALOG_STALE_MS,
} from '../desktopShellQueryFreshness';

const dir = dirname(fileURLToPath(import.meta.url));

describe('desktopShellQueryFreshness', () => {
	it('keeps bootstrap stale window ≥ 2 minutes', () => {
		expect(DESKTOP_SHELL_BOOTSTRAP_STALE_MS).toBeGreaterThanOrEqual(120_000);
		expect(DESKTOP_SHELL_GAF_CHATS_STALE_MS).toBeGreaterThanOrEqual(60_000);
		expect(DESKTOP_SHELL_STORE_CATALOG_STALE_MS).toBeGreaterThanOrEqual(
			120_000
		);
	});

	it('cold callers import shared freshness constants', () => {
		const files = [
			'../../../../contexts/AuthContext.tsx',
			'../../../../contexts/UserPreferencesAppContext.tsx',
			'../../../../notifications/NotificationCenterSync.tsx',
			'../../components/GAFChat/gafChatQueryOptions.ts',
			'../../../../features/friends/hooks/useFriendsOverview.ts',
			'../../hooks/useDesktopInstalledApps.ts',
		];
		for (const rel of files) {
			const src = readFileSync(join(dir, rel), 'utf8');
			expect(src, rel).toContain('DESKTOP_SHELL_');
		}
	});
});
