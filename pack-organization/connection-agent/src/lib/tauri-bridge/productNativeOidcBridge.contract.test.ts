/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source lock: product WebView gets host-injected EmperyDesktopNativeOidc;
 * native_oidc_* stay off product.json; refresh JSON never includes refresh token.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.4
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const tauriSrc = join(here, '../../../src-tauri/src');
const capabilities = join(here, '../../../src-tauri/capabilities');

describe('product native OIDC host inject (source)', () => {
	const bridge = readFileSync(
		join(tauriSrc, 'native_oidc/product_bridge.rs'),
		'utf8'
	);
	const productRs = readFileSync(join(tauriSrc, 'commands/product.rs'), 'utf8');
	const productCap = readFileSync(join(capabilities, 'product.json'), 'utf8');
	const connectedSessionCap = readFileSync(
		join(capabilities, 'product-connected-session.json'),
		'utf8'
	);
	const mainCap = readFileSync(join(capabilities, 'default.json'), 'utf8');

	it('product_open installs an origin-guarded initialization_script', () => {
		expect(productRs).toContain('initialization_script');
		expect(productRs).toContain('product_bridge::bootstrap_for_open');
		expect(bridge).toContain('EmperyDesktopNativeOidc');
		expect(bridge).toContain('https://app.eliteew.ru');
		expect(bridge).toContain('fofline-spa:');
		expect(bridge).toContain('/fofline-oidc-bridge.html');
	});

	it('product session IPC is not native_oidc_* and is product-capability only', () => {
		expect(bridge).toContain('product_session_refresh');
		expect(bridge).toContain('product_session_logout');
		expect(bridge).toContain('logoutSessionJson');
		expect(bridge).not.toContain('invoke("native_oidc_');
		expect(productCap).toContain('allow-product-session-refresh');
		expect(productCap).toContain('allow-product-session-logout');
		expect(productCap).not.toMatch(/"remote"/);
		expect(productCap).not.toMatch(/native-oidc/);
		expect(connectedSessionCap).toContain('"https://app.eliteew.ru"');
		expect(connectedSessionCap).toContain('"https://app.eliteew.ru/*"');
		expect(connectedSessionCap).toContain('allow-product-session-logout');
		expect(connectedSessionCap).not.toMatch(/native-oidc/);
		expect(JSON.parse(connectedSessionCap).permissions).toEqual([
			'core:default',
			'allow-product-session-refresh',
			'allow-product-session-logout',
			'allow-video-call-meet-stage-open',
			'allow-video-call-meet-stage-set-bounds',
			'allow-video-call-meet-stage-close',
		]);
		expect(mainCap).not.toContain('"https://app.eliteew.ru"');
		expect(mainCap).not.toContain('allow-product-session-refresh');
		expect(mainCap).not.toContain('allow-product-session-logout');
		expect(mainCap).not.toContain('allow-video-call-meet-stage-open');
		expect(mainCap).toContain('allow-native-oidc-refresh');
		expect(mainCap).toContain('allow-native-oidc-interactive-login');
	});

	it('product_session_logout wipes browsing data then destroys the product window', () => {
		const sessionRs = readFileSync(
			join(tauriSrc, 'commands/product_session.rs'),
			'utf8',
		);
		expect(sessionRs).toContain('wipe_product_webview');
		expect(sessionRs).toContain('w.destroy()');
		expect(sessionRs).toContain('product_session_logout_close');
		expect(sessionRs).not.toContain(
			'product_close_for_license_kill_switch(&app)',
		);
		expect(sessionRs).not.toContain(
			'product_bridge::push_bridge_into_product_if_open(&app, client)',
		);
	});
});
