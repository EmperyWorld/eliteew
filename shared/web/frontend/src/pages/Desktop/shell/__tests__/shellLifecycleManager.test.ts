/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Desktop Shell Lifecycle Manager facade (U0 mission collapse).
 *
 * Related:
 * - src/pages/Desktop/shell/shellLifecycleManager.ts
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
	getCompanionViewPrefs,
	isMissionChromeCollapsed,
	setMissionCollapsed,
	subscribeShellLifecycle,
} from '@/pages/Desktop/shell/shellLifecycleManager';

describe('shellLifecycleManager', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it('exposes setMissionCollapsed via Shell facade', () => {
		const seen: string[] = [];
		const unsub = subscribeShellLifecycle((pid) => {
			seen.push(pid);
		});
		setMissionCollapsed('principal-a', 'run-42', false);
		expect(isMissionChromeCollapsed('principal-a', 'run-42', false)).toBe(
			false
		);
		expect(getCompanionViewPrefs('principal-a').collapsedMissionIds).toEqual(
			[]
		);
		expect(seen).toContain('principal-a');
		unsub();
	});
});
