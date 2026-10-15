/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock idle Network cadence for deploy-version and maintenance polls (wave 4).
 *
 * Related:
 * - utils/staleBundleReload.ts
 * - contexts/MaintenanceContext.tsx
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('idle poll cadence (desktop cold path wave 4)', () => {
	it('deploy version background poll is at least 5 minutes', () => {
		const src = readFileSync(
			resolve(__dirname, '../staleBundleReload.ts'),
			'utf8'
		);
		expect(src).toMatch(/DEPLOY_POLL_MS\s*=\s*300_000/);
	});

	it('maintenance idle poll is at least 2 minutes with socket live path', () => {
		const src = readFileSync(
			resolve(__dirname, '../../contexts/MaintenanceContext.tsx'),
			'utf8'
		);
		expect(src).toMatch(/const POLL_MS\s*=\s*120_000/);
		expect(src).toContain('system.maintenance');
	});
});
