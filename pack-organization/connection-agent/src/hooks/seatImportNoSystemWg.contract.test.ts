/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock seat/capsule import to userspace W-transport only (no OS wg install).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §Sealed Capsule
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seatImport = join(root, 'hooks/useSeatPackageImport.ts');
const libRs = join(root, '../src-tauri/src/lib.rs');

describe('seat import No System Footprint (source)', () => {
	it('never calls wgInstallHandoff; Capsule/keyring only (no seatChannelBringUp)', () => {
		const src = readFileSync(seatImport, 'utf8');
		expect(src).not.toContain('seatChannelBringUp');
		expect(src).not.toContain('wg_conf');
		expect(src).not.toContain('wTransportStartConf');
		expect(src).not.toContain('wgInstallHandoff');
		expect(src).not.toContain('wgBringUp');
		expect(src).not.toMatch(/\bawait\s+wgInstall/);
		expect(src).not.toMatch(/\bwg_install_handoff\b/);
	});

	it('Exit tears down W-transport', () => {
		const src = readFileSync(libRs, 'utf8');
		expect(src).toMatch(
			/RunEvent::Exit[\s\S]*?w_transport_stop_for_app\(app\)[\s\S]*?end_webkit_session/
		);
	});
});
