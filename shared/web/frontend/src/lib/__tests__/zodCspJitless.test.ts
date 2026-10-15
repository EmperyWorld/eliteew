/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard Zod CSP jitless bootstrap (module + classic public script + index.html).
 *
 * Related:
 * - src/lib/zodCspJitless.ts
 * - public/zod-csp-jitless.js
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import '../zodCspJitless';

const FRONTEND_ROOT = resolve(import.meta.dirname, '../../..');

describe('zod CSP jitless bootstrap', () => {
	it('sets z.config({ jitless: true }) from module side-effect', () => {
		expect(z.config().jitless).toBe(true);
	});

	it('ships classic public script that sets __zod_globalConfig.jitless', () => {
		const script = readFileSync(
			resolve(FRONTEND_ROOT, 'public/zod-csp-jitless.js'),
			'utf8'
		);
		expect(script).toContain('__zod_globalConfig');
		expect(script).toContain('cfg.jitless = true');
		expect(script).not.toMatch(/\bnew\s+Function\s*\(/);
		expect(script).not.toMatch(/\beval\s*\(/);
	});

	it('loads zod-csp-jitless.js before SPA modules in index.html', () => {
		const html = readFileSync(resolve(FRONTEND_ROOT, 'index.html'), 'utf8');
		const jitlessPos = html.indexOf('src="/zod-csp-jitless.js"');
		const mainPos = html.indexOf('src="/src/main.tsx"');
		expect(jitlessPos).toBeGreaterThan(-1);
		expect(mainPos).toBeGreaterThan(-1);
		expect(jitlessPos).toBeLessThan(mainPos);
	});
});
