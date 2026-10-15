/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Linux auto OTA apply path (no shell WEBKIT tips for retail users).
 *
 * Invariants:
 * - useUpdater exposes handleUpdateCheckAndAutoApply.
 * - App boots auto-apply after nativeReady.
 * - Desktop Exec must not inject updater pubkey (Root of Trust is baked).
 * - W-transport may still be forced ON for menu launches.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '../../..');

describe('desktop-client Linux graphics / OTA auto-apply', () => {
	it('exposes auto-apply in useUpdater and App boot', () => {
		const hook = readFileSync(
			join(clientRoot, 'src/hooks/useUpdater.ts'),
			'utf8'
		);
		const app = readFileSync(join(clientRoot, 'src/App.tsx'), 'utf8');
		expect(hook).toContain('handleUpdateCheckAndAutoApply');
		expect(hook).toContain("detectBuildChannel() !== 'rpm'");
		expect(app).toContain('handleUpdateCheckAndAutoApply');
		expect(app).toContain('nativeReady');
	});

	it('does not put updater pubkey in linux desktop Exec; no forced WEBKIT_*', () => {
		const desk = readFileSync(
			join(clientRoot, 'packaging/linux/desktop-template.desktop'),
			'utf8'
		);
		expect(desk).not.toContain('DESKTOP_CLIENT_UPDATER_PUBKEY');
		expect(desk).toContain('ELITEEW_FOFLINE_W_TRANSPORT=1');
		expect(desk).not.toContain('WEBKIT_DISABLE_DMABUF_RENDERER');
		expect(desk).not.toContain('WEBKIT_DISABLE_COMPOSITING_MODE');
		expect(desk).toContain('Exec=env');
		expect(desk).toContain('{{exec}}');
	});

	it('release binary ensures W-transport packaged default', () => {
		const main = readFileSync(
			join(clientRoot, 'src-tauri/src/main.rs'),
			'utf8'
		);
		const lib = readFileSync(join(clientRoot, 'src-tauri/src/lib.rs'), 'utf8');
		expect(main).toContain('ensure_w_transport_packaged_default');
		expect(lib).toContain('ensure_w_transport_packaged_default');
		expect(lib).toContain('ensure_packaged_w_transport_default');
	});

	it('keeps DMA-BUF by default; compositing-off only as escalate', () => {
		const rs = readFileSync(
			join(clientRoot, 'src-tauri/src/webkit_linux.rs'),
			'utf8'
		);
		const main = readFileSync(
			join(clientRoot, 'src-tauri/src/main.rs'),
			'utf8'
		);
		expect(rs).toContain('DMA-BUF path kept (default');
		expect(rs).toContain('ELITEEW_WEBKIT_FORCE_DMABUF_OFF');
		expect(rs).toContain('clear_legacy_full_safe_mode_flag');
		expect(rs).toContain('clear_poisoned_double_apply_sticky');
		expect(rs).toContain('clear_poisoned_single_unclean_sticky');
		expect(rs).toContain('UNCLEAN_STRIKES_BEFORE_STICKY');
		expect(rs).toContain('clear_marker_on_signal');
		expect(rs).toContain('APPLY_DONE_THIS_PROCESS');
		expect(rs).toContain('mark_compositing_off_sticky');
		expect(rs).toContain('double_apply_does_not_false_escalate');
		expect(rs).toContain('single_unclean_exit_keeps_gpu_compositing');
		expect(rs).toContain('default_keeps_dmabuf_and_compositing');
		expect(main).toContain('apply_linux_graphics_before_webview');
		expect(main).not.toContain('ensure_updater_pubkey_env');
	});

	it('ships updater recovery command for broken signing bake', () => {
		const bridge = readFileSync(
			join(clientRoot, 'src/lib/tauri-bridge/commands.ts'),
			'utf8'
		);
		const hook = readFileSync(
			join(clientRoot, 'src/hooks/useUpdater.ts'),
			'utf8'
		);
		const defaults = readFileSync(
			join(clientRoot, 'src-tauri/src/client_defaults.rs'),
			'utf8'
		);
		expect(bridge).toContain('updaterRecoveryInstall');
		expect(hook).toContain('handleRecoveryInstall');
		expect(hook).toContain('signing_required');
		expect(defaults).toContain('BAKED_UPDATER_PUBKEY_CONNECTED');
		expect(defaults).toContain('trusted_updater_pubkey');
		expect(defaults).not.toContain(
			'env_nonempty("DESKTOP_CLIENT_UPDATER_PUBKEY")'
		);
		expect(defaults).not.toContain('resolve_latest_json_url');
		expect(defaults).toContain('resolve_recovery_latest_json_url');
	});

	it('ships no dead ENV_PUBKEY / post_openai_chat stubs in release sources', () => {
		const entitlement = readFileSync(
			join(clientRoot, 'src-tauri/src/entitlement.rs'),
			'utf8'
		);
		const aiHttp = readFileSync(
			join(clientRoot, 'src-tauri/src/ai_http.rs'),
			'utf8'
		);
		expect(entitlement).not.toMatch(/pub const ENV_PUBKEY/);
		expect(aiHttp).not.toMatch(/pub async fn post_openai_chat\(/);
		expect(aiHttp).toContain('post_openai_chat_local');
	});

	it('ships in-app WebKit sticky recovery (no shell rm)', () => {
		const rs = readFileSync(
			join(clientRoot, 'src-tauri/src/webkit_linux.rs'),
			'utf8'
		);
		const cmd = readFileSync(
			join(clientRoot, 'src-tauri/src/commands/webkit_graphics.rs'),
			'utf8'
		);
		const bridge = readFileSync(
			join(clientRoot, 'src/lib/tauri-bridge/commands.ts'),
			'utf8'
		);
		const hook = readFileSync(
			join(clientRoot, 'src/hooks/useWebkitGraphicsRecovery.ts'),
			'utf8'
		);
		const updaterUi = readFileSync(
			join(clientRoot, 'src/features/updater/UpdaterStatus.tsx'),
			'utf8'
		);
		const app = readFileSync(join(clientRoot, 'src/App.tsx'), 'utf8');
		expect(rs).toContain('clear_graphics_sticky_for_user_recovery');
		expect(rs).toContain('user_recovery_clears_sticky_without_shell');
		expect(cmd).toContain('webkit_graphics_reset');
		expect(cmd).toContain('cleared_restart_required');
		expect(bridge).toContain('webkitGraphicsReset');
		expect(hook).toContain('handleRecovery');
		expect(updaterUi).toContain('Вернуть плавность');
		expect(app).toContain('useWebkitGraphicsRecovery');
	});
});
