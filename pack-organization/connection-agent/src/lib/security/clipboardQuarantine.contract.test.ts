/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock FoFline product clipboard quarantine + edition-isolated history (CISO P1).
 *
 * Invariants:
 * - clipboard_* commands take Window and deny label=product.
 * - FoFline history path is history_fofline_v1.json (not Cloud history_v1).
 *
 * Related:
 * - DESKTOP-FOFLINE-EDITION.md L5 / sterile residuals
 * - clipboard.rs / clipboard_history.rs
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

describe('FoFline product clipboard quarantine', () => {
	it('denies OS clipboard IPC from product window', () => {
		const src = readFileSync(
			resolve(root, 'src-tauri/src/commands/clipboard.rs'),
			'utf8',
		);
		expect(src).toMatch(/deny_if_product_window/);
		expect(src).toMatch(/window\.label\(\) != "product"/);
		expect(src).toMatch(/clipboard_quarantine/);
		expect(src).toMatch(/fn clipboard_status\(app: AppHandle, window: Window\)/);
		expect(src).toMatch(/fn clipboard_read\(app: AppHandle, window: Window\)/);
		expect(src).toMatch(/fn clipboard_write\(/);
	});

	it('isolates FoFline native history path', () => {
		const src = readFileSync(
			resolve(root, 'src-tauri/src/clipboard_history.rs'),
			'utf8',
		);
		expect(src).toMatch(/history_fofline_v1\.json/);
		expect(src).toMatch(/store_path_for/);
		expect(src).toMatch(/load_for/);
		expect(src).toMatch(/persist_for/);
	});
});
