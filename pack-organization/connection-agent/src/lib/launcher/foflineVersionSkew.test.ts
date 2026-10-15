/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for FoFline L4 shell vs SPA pack vs remote spa-latest skew.
 *
 * Invariants:
 * - Ready local pack stays usable while SPA update is offered.
 * - Shell and SPA channels stay separate (no merged version string).
 *
 * Related:
 * - lib/launcher/foflineVersionSkew.ts
 */

import { describe, expect, it } from 'vitest';
import { resolveFoflineVersionSkew } from './foflineVersionSkew';

describe('resolveFoflineVersionSkew', () => {
	it('flags SPA update without blocking local Start', () => {
		const skew = resolveFoflineVersionSkew({
			shellVersion: '0.4.20',
			packState: 'ready',
			localSpaAppBuildId: 'old-id',
			remoteSpaAppBuildId: 'new-id',
			spaUpdateAvailable: true,
		});
		expect(skew.kind).toBe('spa_update_available');
		expect(skew.code).toBe('update_available');
		expect(skew.localPackUsable).toBe(true);
		expect(skew.spaUpdateAction).toBe(true);
		expect(skew.localSpaAppBuildId).toBe('old-id');
		expect(skew.remoteSpaAppBuildId).toBe('new-id');
	});

	it('treats matching ids as current', () => {
		const skew = resolveFoflineVersionSkew({
			shellVersion: '0.4.20',
			packState: 'ready',
			localSpaAppBuildId: 'same',
			remoteSpaAppBuildId: 'same',
		});
		expect(skew.kind).toBe('spa_current');
		expect(skew.spaUpdateAction).toBe(false);
		expect(skew.localPackUsable).toBe(true);
	});

	it('keeps local usable when remote check fails', () => {
		const skew = resolveFoflineVersionSkew({
			shellVersion: '0.4.20',
			packState: 'ready',
			localSpaAppBuildId: 'local-only',
			remoteSpaAppBuildId: null,
			remoteCheckFailed: true,
		});
		expect(skew.kind).toBe('check_unavailable');
		expect(skew.localPackUsable).toBe(true);
		expect(skew.spaUpdateAction).toBe(false);
	});

	it('does not claim SPA current when pack missing', () => {
		const skew = resolveFoflineVersionSkew({
			shellVersion: '0.4.20',
			packState: 'pack_missing',
			localSpaAppBuildId: null,
			remoteSpaAppBuildId: 'remote',
		});
		expect(skew.kind).toBe('spa_missing');
		expect(skew.localPackUsable).toBe(false);
		expect(skew.spaUpdateAction).toBe(true);
	});

	it('notes shell update without inventing SPA skew', () => {
		const skew = resolveFoflineVersionSkew({
			shellVersion: '0.4.20',
			packState: 'ready',
			localSpaAppBuildId: 'abc',
			remoteSpaAppBuildId: 'abc',
			shellUpdateAvailable: '0.4.22',
		});
		expect(skew.kind).toBe('shell_update_also');
		expect(skew.spaUpdateAction).toBe(false);
		expect(skew.shellUpdateAvailable).toBe('0.4.22');
	});
});
