/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * NCR-004 — Start CTAs must not hardcode preflightOk: true.
 *
 * Related:
 * - useCloudStart.ts · useFoflineStart.ts · entitlementGate.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cloud = join(root, 'hooks/useCloudStart.ts');
const fofline = join(root, 'hooks/useFoflineStart.ts');

describe('Start preflightOk honesty (NCR-004)', () => {
	it('Cloud Start wires canOpenCloudSpa to live preflightOk state', () => {
		const src = readFileSync(cloud, 'utf8');
		expect(src).toContain('useState(false)');
		expect(src).toContain('useEffect');
		expect(src).toContain('licensePreflight');
		expect(src).toContain('preflightOk,');
		expect(src).toMatch(/canOpenCloudSpa\(\{[\s\S]*?preflightOk,/);
		expect(src).not.toMatch(/preflightOk:\s*true/);
		expect(src).not.toContain('void preflightOk');
	});

	it('FoFline Start wires canOpenFoflineSpa to live preflightOk state', () => {
		const src = readFileSync(fofline, 'utf8');
		expect(src).toContain('useState(false)');
		expect(src).toContain('useEffect');
		expect(src).toContain('licensePreflight');
		expect(src).toMatch(/canOpenFoflineSpa\(\{[\s\S]*?preflightOk,/);
		expect(src).not.toMatch(/preflightOk:\s*true/);
	});

	it('FoFline Start does not open remote SPA or promise remote mode', () => {
		const src = readFileSync(fofline, 'utf8');
		expect(src).not.toContain('resolveFoflineStartCutover');
		expect(src).not.toContain('isFoflineRemoteStartFallbackEnabled');
		expect(src).toContain("kind: 'foflineLocal'");
	});
});
