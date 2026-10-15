/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock W-transport refresh/bring-up runs L7 probe before chip labels.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tunnelChipValue } from '../lib/launcher/shellChips';

const portal = join(dirname(fileURLToPath(import.meta.url)), 'useWgPortal.ts');

describe('useWgPortal L7 refresh (source)', () => {
	it('applyWTransport probes L7 when requested', () => {
		const src = readFileSync(portal, 'utf8');
		expect(src).toContain('wTransportL7Probe');
		expect(src).toContain('probeL7');
		expect(src).toMatch(/handleRefreshWg[\s\S]*?probeL7:\s*true/);
		expect(src).toMatch(/handleBringUp[\s\S]*?probeL7:\s*true/);
	});
});

describe('tunnelChipValue', () => {
	it('shows protected after L7 and connecting while socks only', () => {
		expect(
			tunnelChipValue({
				ok: true,
				code: 'protected',
				message: 'ok',
				unit_active: true,
				conf_present: true,
			})
		).toBe('Защищено');
		expect(
			tunnelChipValue({
				ok: true,
				code: 'socks_listening',
				message: 'up',
				unit_active: true,
				conf_present: true,
			})
		).toBe('Подключение');
		expect(
			tunnelChipValue({
				ok: false,
				code: 'reconnecting',
				message: 'recover',
				unit_active: false,
				conf_present: true,
			})
		).toBe('Восстанавливаем');
		expect(
			tunnelChipValue({
				ok: false,
				code: 'channel_unstable',
				message: 'unstable',
				unit_active: false,
				conf_present: true,
			})
		).toBe('Соединение нестабильно');
	});
});
