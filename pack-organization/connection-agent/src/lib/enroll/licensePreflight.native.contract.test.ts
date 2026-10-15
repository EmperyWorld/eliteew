/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock license preflight/heartbeat to native Tauri egress when runtime is Tauri.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), 'licensePreflight.ts'),
	'utf8'
);

describe('licensePreflight native egress (source)', () => {
	it('uses license_preflight_cmd in Tauri instead of WebView fetch only', () => {
		expect(src).toContain('isTauriRuntime');
		expect(src).toContain('licensePreflightNative');
		expect(src).toContain('licenseHeartbeatNative');
	});

	it('does not map IPC/ACL failure to generic network_error copy', () => {
		expect(src).toContain('ipc_capability_denied');
		expect(src).toContain('mapInvokeFailure');
		expect(src).toMatch(
			/if \(isTauriRuntime\(\)\) \{\s*try \{[\s\S]*?catch \(err\) \{\s*return mapInvokeFailure/
		);
		const invokeFail = src.split('function mapInvokeFailure')[1]?.split(
			'async function postLicenseGate'
		)[0];
		expect(invokeFail).toBeTruthy();
		expect(invokeFail).not.toMatch(/code:\s*'network_error'/);
	});
});
