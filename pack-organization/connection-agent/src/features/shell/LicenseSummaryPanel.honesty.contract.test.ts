/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full Security license-ui lock — denied hero for expired/revoked; no «активна» CTA.
 *
 * Related:
 * - DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §Full Security
 * - .cursor/plans/license_gate_fail-closed_c8333fe4.plan.md §D
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const summary = join(root, 'features/shell/LicenseSummaryPanel.tsx');
const shell = join(root, 'features/shell/ShellStep.tsx');
const connection = join(root, 'lib/launcher/journey/connectionSignal.ts');

describe('LicenseSummary honesty (Full Security)', () => {
	it('fail-closed denied hero for any !ok (incl. kill codes) and FoFline «Недоступна»', () => {
		const src = readFileSync(summary, 'utf8');
		expect(src).toContain('if (entitlement == null)');
		expect(src).toContain('return null');
		expect(src).toContain('const denied = !entitlement.ok');
		expect(src).toContain('function deniedHeroTitle');
		expect(src).toContain('Срок лицензии истёк');
		expect(src).toContain('Доступ отозван');
		expect(src).toContain('Время на устройстве не совпадает');
		expect(src).toContain('Доступ недоступен');
		expect(src).toContain('device_revoked');
		expect(src).toContain('license-summary-denied');
		expect(src).toMatch(/denied\s*\?\s*'Недоступна'/);
	});

	it('ShellStep mounts summary only on entitlement fact (NCR-001)', () => {
		const src = readFileSync(shell, 'utf8');
		expect(src).toContain('entitlement != null ? (');
		expect(src).toContain('<LicenseSummaryPanel');
		expect(src).not.toMatch(
			/entitlement\?\.ok\s*\|\|\s*\n?\s*onlineBoundLabel/
		);
		expect(src).not.toMatch(/onlineBoundLabel\s*\|\|\s*\n?\s*\(entitlement/);
	});

	it('connection protected hint does not promise Start', () => {
		const src = readFileSync(connection, 'utf8');
		expect(src).toContain("protected: 'Защищённый канал активен.'");
		expect(src).not.toContain('Можно открывать EliteEW');
	});
});
