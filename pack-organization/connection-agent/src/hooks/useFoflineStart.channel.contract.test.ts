/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock FoFline Start click: channel recover before native preflight; local-only open.
 *
 * Related:
 * - useFoflineStart.ts
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.1
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), 'useFoflineStart.ts'),
	'utf8'
);

describe('useFoflineStart channel gate (source)', () => {
	it('waits for boot channel restore before license preflight', () => {
		expect(src).toContain('channelRestoreDone');
		expect(src).toMatch(/if \(!channelRestoreDone\)/);
	});

	it('click path checks channel with recover before native license preflight', () => {
		const click = src.slice(src.indexOf('handleFoflineStartAttempt'));
		const channelAt = click.indexOf('assertProductChannelReadyWithRecover');
		const preflightAt = click.indexOf('licensePreflight');
		expect(channelAt).toBeGreaterThan(-1);
		expect(preflightAt).toBeGreaterThan(channelAt);
		expect(click).not.toContain('resolveFoflineStartCutover');
		expect(click).not.toContain('удалённый режим');
		expect(click).toContain("kind: 'foflineLocal'");
		expect(click).toContain("'Открыт FoFline'");
	});

	it('exposes recover/pending parity with Cloud Start', () => {
		expect(src).toContain('refreshLicensePreflight');
		expect(src).toContain('foflineGateDetail');
		expect(src).toContain('preflightPending');
		expect(src).not.toMatch(/preflightOk:\s*true/);
	});
});
