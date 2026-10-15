/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source lock: product_open applies fail-closed SOCKS for Connected + FoFline
 * and accepts typed ProductTarget only (Wave 6 / F-10).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const productRs = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../src-tauri/src/commands/product.rs',
);

describe('product_open W-transport SOCKS (source)', () => {
	it('requires proxy for any Start when w_transport enabled', () => {
		const src = readFileSync(productRs, 'utf8');
		expect(src).toContain('let w_transport = w_transport_enabled();');
		expect(src).toMatch(/if w_transport \{[\s\S]*?w_transport_proxy_required/);
		expect(src).not.toMatch(/if fofline && w_transport_enabled\(\)/);
	});

	it('recreates product window when W-transport is on (Connected + FoFline)', () => {
		const src = readFileSync(productRs, 'utf8');
		expect(src).toContain('if fofline || w_transport');
		expect(src).toContain('recreate_product_window');
	});

	it('product_open accepts ProductTarget enum, not caller URL (Wave 6)', () => {
		const src = readFileSync(productRs, 'utf8');
		expect(src).toMatch(/enum ProductTarget/);
		expect(src).toMatch(
			/pub fn product_open\(app: AppHandle, target: ProductTarget\)/,
		);
		expect(src).not.toMatch(
			/pub fn product_open\(app: AppHandle, url: String\)/,
		);
		expect(src).toContain('navigation_allowed_for_connected_cloud');
	});
});
