/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 2 Lock — sync diagnostics export stays behind nested disclosure.
 *
 * Related:
 * - ../expansion/DesktopSettingsExpansionShellSyncDataCard.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopSettingsExpansionShellSyncDataCard diagnostics (Wave 2)', () => {
	it('keeps diagnostics exports behind sync-diagnostics disclosure', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../expansion/DesktopSettingsExpansionShellSyncDataCard.tsx'),
			'utf8'
		);

		const refreshIdx = src.indexOf('settingsCenterRefresh');
		const disclosureIdx = src.indexOf(
			'data-testid="desktop-settings-sync-diagnostics"'
		);
		const summaryExportIdx = src.indexOf('diagnosticsSummaryExport');
		expect(refreshIdx).toBeGreaterThan(-1);
		expect(disclosureIdx).toBeGreaterThan(-1);
		expect(summaryExportIdx).toBeGreaterThan(disclosureIdx);
		expect(src).toContain('settingsPanel.diagnosticsSectionTitle');
	});
});
