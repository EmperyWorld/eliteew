/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * NCR-005 — heartbeat kill-switch must not rely on 30s-only polling.
 *
 * Related:
 * - licenseHeartbeatLoop.ts · DESKTOP-CLIENT-SECURITY-BOUNDARIES.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { LICENSE_HEARTBEAT_INTERVAL_MS } from './licenseHeartbeatLoop';

const loopPath = join(
	dirname(fileURLToPath(import.meta.url)),
	'licenseHeartbeatLoop.ts'
);

describe('license heartbeat interval (NCR-005)', () => {
	it('exports interval under 15s (API rate-limit safe)', () => {
		expect(LICENSE_HEARTBEAT_INTERVAL_MS).toBeLessThanOrEqual(15_000);
		expect(LICENSE_HEARTBEAT_INTERVAL_MS).toBeGreaterThanOrEqual(5_000);
	});

	it('loop source does not hardcode 30_000 ms interval', () => {
		const src = readFileSync(loopPath, 'utf8');
		expect(src).toContain('LICENSE_HEARTBEAT_INTERVAL_MS');
		expect(src).not.toMatch(/INTERVAL_MS\s*=\s*30_000/);
		expect(src).toContain('visibilitychange');
	});
});
