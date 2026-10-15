/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for Start URL bind hydration (#015).
 */

import { describe, expect, it } from 'vitest';
import { bindPatchFromEntitlement, resolveStartBindIds } from './bindHydration';
import { buildProductStartUrl } from './productStart';

describe('resolveStartBindIds', () => {
	it('prefers session bind over entitlement and persisted', () => {
		expect(
			resolveStartBindIds({
				bindLicenseId: 'lic-session',
				bindDeviceId: 'dev-session',
				entitlement: { license_id: 'lic-ent', device_id: 'dev-ent' },
				persisted: { licenseId: 'lic-persisted', deviceId: 'dev-persisted' },
			})
		).toEqual({ licenseId: 'lic-session', deviceId: 'dev-session' });
	});

	it('falls back to entitlement then persisted for cold start', () => {
		expect(
			resolveStartBindIds({
				bindLicenseId: null,
				bindDeviceId: null,
				entitlement: { license_id: 'lic-ent', device_id: null },
				persisted: { licenseId: null, deviceId: 'dev-persisted' },
			})
		).toEqual({ licenseId: 'lic-ent', deviceId: 'dev-persisted' });
	});

	it('builds Start URL without bind query params after cold hydration (Wave 2)', () => {
		const ids = resolveStartBindIds({
			entitlement: {
				license_id: '11111111-1111-1111-1111-111111111111',
				device_id: '22222222-2222-2222-2222-222222222222',
			},
		});
		expect(ids.licenseId).toBe('11111111-1111-1111-1111-111111111111');
		expect(
			buildProductStartUrl('https://app.eliteew.ru', {
				licenseId: ids.licenseId,
				deviceId: ids.deviceId,
			})
		).toBe('https://app.eliteew.ru/?eliteewDesktopClient=1');
	});
});

describe('bindPatchFromEntitlement', () => {
	it('returns only present ids', () => {
		expect(
			bindPatchFromEntitlement({
				license_id: 'lic-1',
				device_id: '  ',
			})
		).toEqual({ licenseId: 'lic-1' });
	});
});
