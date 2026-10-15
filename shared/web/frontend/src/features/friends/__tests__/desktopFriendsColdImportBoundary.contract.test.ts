/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard: idle desktop shell must not import the friends feature barrel (Social Hub UI).
 *
 * Invariants:
 * - Tray / visual bridge use `hooks/useFriendsOverview` only.
 * - GAF always-on helpers use `api/friendsApi` + `types`, not `@/features/friends`.
 *
 * Related:
 * - documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md §Cold #desktop
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESKTOP_ROOT = join(__dirname, '../../../pages/Desktop');
const BARREL_RE = /from\s+['"]@\/features\/friends['"]/;
const ALLOWED_DEEP_PREFIXES = [
	'@/features/friends/hooks/useFriendsOverview',
	'@/features/friends/hooks/useFriends',
	'@/features/friends/api/',
	'@/features/friends/types',
	'@/features/friends/components/',
	'@/features/friends/social-hub/',
];

function walkTsFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		if (name === '__tests__' || name === 'node_modules') continue;
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) {
			out.push(...walkTsFiles(full));
			continue;
		}
		if (
			/\.(ts|tsx)$/.test(name) &&
			!name.endsWith('.test.ts') &&
			!name.endsWith('.test.tsx')
		) {
			out.push(full);
		}
	}
	return out;
}

describe('desktopFriendsColdImportBoundary', () => {
	it('pages/Desktop does not import the friends barrel', () => {
		const offenders: string[] = [];
		for (const file of walkTsFiles(DESKTOP_ROOT)) {
			const src = readFileSync(file, 'utf8');
			if (BARREL_RE.test(src)) {
				offenders.push(file.replace(DESKTOP_ROOT, 'pages/Desktop'));
			}
		}
		expect(offenders).toEqual([]);
	});

	it('tray and visual bridge import thin useFriendsOverview', () => {
		const tray = readFileSync(
			join(DESKTOP_ROOT, 'hooks/useDesktopTrayItems.ts'),
			'utf8'
		);
		const bridge = readFileSync(
			join(DESKTOP_ROOT, 'hooks/useDesktopWorkspaceVisualProfileBridge.ts'),
			'utf8'
		);
		expect(tray).toContain(
			"from '@/features/friends/hooks/useFriendsOverview'"
		);
		expect(bridge).toContain(
			"from '@/features/friends/hooks/useFriendsOverview'"
		);
		expect(tray).not.toMatch(/from ['"]@\/features\/friends['"]/);
		expect(bridge).not.toMatch(/from ['"]@\/features\/friends['"]/);
		// sanity: allowed deep prefixes list stays intentional
		expect(ALLOWED_DEEP_PREFIXES.length).toBeGreaterThan(3);
	});
});
