/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock cloud Start eager preflight behind W-transport channel readiness.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), 'useCloudStart.ts'),
	'utf8'
);

describe('useCloudStart channel gate (source)', () => {
	it('waits for boot channel restore before license preflight', () => {
		expect(src).toContain('channelRestoreDone');
		expect(src).toMatch(/if \(!channelRestoreDone\)/);
	});

	it('checks product channel (with recover) before native license preflight', () => {
		expect(src).toContain('assertProductChannelReadyWithRecover');
		expect(src).toMatch(
			/assertProductChannelReadyWithRecover\(\)[\s\S]*licensePreflight\(/
		);
	});

	it('retries eager preflight when portal channel code changes', () => {
		expect(src).toContain('productChannelListening');
		expect(src).toContain('productChannelCode');
		expect(src).toContain('channel_unconfirmed');
		expect(src).toContain('refreshLicensePreflight');
	});

	it('success copy is honest and does not echo opened.url', () => {
		expect(src).toContain("'Открыт облачный стол'");
		expect(src).not.toMatch(/opened\.url/);
	});
});
