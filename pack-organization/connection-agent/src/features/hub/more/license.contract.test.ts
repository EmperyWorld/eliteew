/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * W5c source locks — retail LicensePanel under Ещё; local wipe only.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.3 / wave W5c
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const more = join(root, 'features/hub/tabs/MoreTab.tsx');
const license = join(root, 'features/hub/more/LicensePanel.tsx');
const app = join(root, 'App.tsx');

describe('Journey W5c License retail UI (source)', () => {
	it('MoreTab mounts LicensePanel with sealed-visible reset CTA path', () => {
		const mor = readFileSync(more, 'utf8');
		const panel = readFileSync(license, 'utf8');
		expect(mor).toContain('LicensePanel');
		expect(mor).toContain('data-layout="more-tab"');
		expect(panel).toContain('Сбросить доступ на этом устройстве');
		expect(panel).toContain('data-cta="local-factory-reset"');
		expect(panel).toContain('runLicenseLocalFactoryReset');
		expect(panel).toContain('resetAllowsSuccessUi');
		expect(panel).toContain('role="dialog"');
		expect(panel).toContain('не отменяется');
		expect(panel).not.toMatch(/type=["']checkbox["']/);
		expect(panel).not.toMatch(/showUninstall|uninstall-with-license/i);
		expect(panel).not.toMatch(/license\/revoke|deviceBindClear/);
		/* Full Security: denied entitlement still mounts summary (expired/revoked hero). */
		expect(panel).toContain('entitlement != null');
		expect(panel).not.toMatch(/entitlement\?\.ok\s*\|\|\s*onlineBoundLabel/);
	});

	it('retail wipe is not gated behind ops-only clear bind', () => {
		const mor = readFileSync(more, 'utf8');
		const panel = readFileSync(license, 'utf8');
		const appSrc = readFileSync(app, 'utf8');
		expect(panel).toContain('data-cta="local-factory-reset-confirm"');
		expect(mor).toMatch(/<LicensePanel[\s\S]*?<ProfileMenu/);
		/* ops clear-bind remains sealed-gated; retail CTA lives in LicensePanel */
		expect(appSrc).toContain('onClearDeviceBind: sealed ? undefined');
		expect(panel).toContain('Сбросить и перезапустить');
	});
});
