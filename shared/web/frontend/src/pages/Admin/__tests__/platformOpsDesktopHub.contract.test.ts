/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Desktop Client admin hub IA — separate licenses vs soft-revoke copy.
 *
 * Related:
 * - PlatformOpsPortalPeersPanel.tsx
 * - documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(
	join(here, '../platformOps/PlatformOpsPortalPeersPanel.tsx'),
	'utf8'
);
const airPanel = readFileSync(
	join(here, '../platformOps/AirEnrollPanel.tsx'),
	'utf8'
);
const ru = JSON.parse(
	readFileSync(join(here, '../../../i18n/locales/ru/desktopUi.json'), 'utf8')
) as {
	adminPlatformOps: {
		desktopHub: { tabs: Record<string, string> };
		licenses: Record<string, string>;
		denylist: Record<string, string>;
		tabs: { portalPeers: string };
	};
};

describe('platform ops desktop hub IA', () => {
	it('splits licenses / denylist / seats / airEnroll / peers / fleet workspaces', () => {
		expect(panel).toContain("workspace === 'licenses'");
		expect(panel).toContain("workspace === 'denylist'");
		expect(panel).toContain("workspace === 'seats'");
		expect(panel).toContain("workspace === 'airEnroll'");
		expect(panel).toContain("workspace === 'peers'");
		expect(panel).toContain("workspace === 'fleet'");
		expect(panel).toContain('data-testid="platform-ops-desktop-workspace"');
		expect(panel).toContain('data-testid="platform-ops-fleet-migration"');
		expect(panel).toContain('<AirEnrollPanel');
		expect(airPanel).toContain('data-testid="platform-ops-air-enroll"');
		expect(panel).toContain('data-testid="license-editor"');
		expect(panel).toContain('data-testid="seat-allow-fofline"');
		expect(panel).toContain('data-testid="license-allow-fofline"');
		expect(panel).toContain('allow_fofline: seatAllowFofline');
		expect(panel).toContain('allow_fofline: capAllowFofline');
		expect(panel).toContain('adminPlatformOps.licenses.howTo');
	});

	it('uses operator-clear RU labels (not Wave/Hard jargon as titles)', () => {
		const { desktopHub, licenses, denylist, tabs, seats, airEnroll } =
			ru.adminPlatformOps as {
				desktopHub: { tabs: Record<string, string> };
				licenses: Record<string, string>;
				denylist: Record<string, string>;
				tabs: { portalPeers: string };
				seats: Record<string, string>;
				airEnroll: Record<string, string>;
			};
		expect(tabs.portalPeers).toBe('Клиент Desktop');
		expect(desktopHub.tabs.licenses).toMatch(/Лицензии/);
		expect(desktopHub.tabs.denylist).toMatch(/Мягкий отзыв/);
		expect(desktopHub.tabs.airEnroll).toMatch(/Air enroll/);
		expect(airEnroll.reveal).toMatch(/один раз/);
		expect(licenses.open).toBe('Изменить');
		expect(licenses.hardRevoke).toBe('Отозвать в базе');
		expect(licenses.inventoryTitle).toBe('Все лицензии');
		expect(licenses.colFofline).toBe('FoFline');
		expect(seats.allowFofline).toBe('Разрешить FoFline');
		expect(denylist.title).toMatch(/Мягкий отзыв/);
		expect(denylist.hint.toLowerCase()).toContain('не список всех лицензий');
		expect(licenses.howTo.toLowerCase()).toContain('изменить');
		expect(licenses.title).not.toMatch(/Wave/i);
		expect(denylist.title).not.toMatch(/Wave/i);
	});
});
