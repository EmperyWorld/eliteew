/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock tray Quit orderly WebView teardown (Layer C Mesa __eglFini SEGV).
 *
 * Invariants:
 * - Quit calls request_quit (not bare app.exit).
 * - CloseRequested on Hub/product calls request_quit (RFC 7009 revoke then exit).
 * - Destroy webviews before delayed exit; CloseRequested allows quit.
 * - ExitRequested { code: None } is prevented so drain can finish with tray alive.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md §Layer C
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '../../..');

describe('desktop-client tray Quit orderly teardown', () => {
	it('request_quit destroys webviews then exits after drain', () => {
		const tray = readFileSync(
			join(clientRoot, 'src-tauri/src/tray.rs'),
			'utf8'
		);
		expect(tray).toContain('pub fn request_quit');
		expect(tray).toContain('QUIT_WEBVIEW_DRAIN_MS');
		expect(tray).toContain('webview_destroyed');
		expect(tray).toContain('.destroy()');
		expect(tray).toContain('app.exit(0)');
		expect(tray).toContain('logout_all_clients');
		expect(tray).toContain('revoke_then_webview_teardown');
		expect(tray).toMatch(/"quit"\s*=>\s*request_quit\(app\)/);
		expect(tray).not.toMatch(/"quit"\s*=>\s*app\.exit\(0\)/);
	});

	it('CloseRequested allows quit; ExitRequested None is prevented for drain', () => {
		const lib = readFileSync(join(clientRoot, 'src-tauri/src/lib.rs'), 'utf8');
		expect(lib).toContain('tray::is_quitting()');
		expect(lib).toContain('CloseRequested');
		expect(lib).toContain('tray::request_quit');
		expect(lib).not.toMatch(/CloseRequested[\s\S]{0,800}window\.hide\(\)/);
		expect(lib).toContain('Destroyed');
		expect(lib).toContain('clear_product_logout_closing');
		expect(lib).toContain('ExitRequested');
		expect(lib).toContain('prevent_exit()');
		expect(lib).toContain('code.is_none()');
		expect(lib).toMatch(
			/RunEvent::Exit[\s\S]*?w_transport_stop_for_app\(app\)[\s\S]*?end_webkit_session/
		);
	});
});
