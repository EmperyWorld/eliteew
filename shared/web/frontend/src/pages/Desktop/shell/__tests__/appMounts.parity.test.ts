/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave F1 parity: API known ⊆ mounts ∪ unmounted; mounts ⊆ known ∪ shell-only.
 *
 * Related:
 * - shell/appMounts.registry.ts
 * - shell/desktopKnownAppComponents.ts
 * - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md
 */

import { describe, expect, it } from 'vitest';
import {
	APP_MOUNTED_COMPONENTS,
	APP_UNMOUNTED_COMPONENTS,
} from '../appMounts.registry';
import {
	API_KNOWN_DESKTOP_APP_COMPONENTS,
	KNOWN_DESKTOP_APP_COMPONENTS,
	SHELL_ONLY_DESKTOP_APP_COMPONENTS,
} from '../desktopKnownAppComponents';

describe('appMounts parity (Wave F1)', () => {
	it('every API-known component is mounted or explicitly unmounted', () => {
		const covered = new Set<string>([
			...APP_MOUNTED_COMPONENTS,
			...APP_UNMOUNTED_COMPONENTS,
		]);
		const missing = [...API_KNOWN_DESKTOP_APP_COMPONENTS].filter(
			(id) => !covered.has(id)
		);
		expect(missing).toEqual([]);
	});

	it('every mounted component is FE-known (API ∪ shell-only)', () => {
		const unknown = APP_MOUNTED_COMPONENTS.filter(
			(id) => !KNOWN_DESKTOP_APP_COMPONENTS.has(id)
		);
		expect(unknown).toEqual([]);
	});

	it('unmounted set does not overlap mounts', () => {
		const overlap = APP_UNMOUNTED_COMPONENTS.filter((id) =>
			(APP_MOUNTED_COMPONENTS as readonly string[]).includes(id)
		);
		expect(overlap).toEqual([]);
	});

	it('shell-only components are in FE known and not API known', () => {
		for (const id of SHELL_ONLY_DESKTOP_APP_COMPONENTS) {
			expect(KNOWN_DESKTOP_APP_COMPONENTS.has(id)).toBe(true);
			expect(API_KNOWN_DESKTOP_APP_COMPONENTS.has(id)).toBe(false);
		}
	});

	it('gold apps remain known and mounted', () => {
		for (const id of [
			'ProjectAboutApp',
			'NotificationsApp',
			'CalendarApp',
			'PoemmaApp',
		]) {
			expect(KNOWN_DESKTOP_APP_COMPONENTS.has(id)).toBe(true);
			expect((APP_MOUNTED_COMPONENTS as readonly string[]).includes(id)).toBe(
				true
			);
		}
	});
});
