/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Tauri single-instance wiring so N FoFline/Desktop processes cannot race
 * shell_state (412) from one seat opening many clients.
 *
 * Invariants:
 * - tauri-plugin-single-instance is a Cargo dependency.
 * - lib.rs registers the plugin with focus/show of the main window.
 * - FoFline and Desktop Connected keep distinct bundle identifiers.
 *
 * Related:
 * - https://v2.tauri.app/plugin/single-instance/
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §6
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '../../..');

describe('desktop-client single-instance', () => {
	it('depends on tauri-plugin-single-instance', () => {
		const cargo = readFileSync(
			join(clientRoot, 'src-tauri/Cargo.toml'),
			'utf8'
		);
		expect(cargo).toMatch(/tauri-plugin-single-instance\s*=/);
	});

	it('wires plugin init + focus existing main window', () => {
		const lib = readFileSync(join(clientRoot, 'src-tauri/src/lib.rs'), 'utf8');
		expect(lib).toContain('tauri_plugin_single_instance::init');
		expect(lib).toContain('focus_existing_main_window');
		expect(lib).toContain('get_webview_window("main")');
		expect(lib).toContain('window.show()');
		expect(lib).toContain('window.set_focus()');
	});

	it('keeps FoFline identifier distinct from Desktop Connected', () => {
		const desktop = JSON.parse(
			readFileSync(join(clientRoot, 'src-tauri/tauri.conf.json'), 'utf8')
		) as { identifier: string };
		const fofline = JSON.parse(
			readFileSync(
				join(clientRoot, 'packaging/fofline/tauri.conf.fofline.overlay.json'),
				'utf8'
			)
		) as { identifier: string };
		expect(desktop.identifier).toBe('world.empery.desktop.client');
		expect(fofline.identifier).toBe('world.empery.fofline');
		expect(desktop.identifier).not.toBe(fofline.identifier);
	});
});
