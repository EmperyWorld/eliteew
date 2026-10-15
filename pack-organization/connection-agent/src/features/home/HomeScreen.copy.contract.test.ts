/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Russian user-facing launcher copy — ban operator English defaults on screens.
 *
 * Invariants:
 * - Source screens must not ship Redeem / Desktop Client / SPA / OTA as primary UX.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const homeDir = dirname(fileURLToPath(import.meta.url));
const featuresDir = join(homeDir, '..');

const SCREEN_FILES = [
	join(homeDir, 'HomeScreen.tsx'),
	join(featuresDir, 'tunnel/TunnelScreen.tsx'),
	join(featuresDir, 'license/LicenseScreen.tsx'),
	join(featuresDir, 'launcher/LauncherScreen.tsx'),
	join(featuresDir, 'profile-menu/ProfileMenu.tsx'),
	join(featuresDir, 'updater/UpdaterStatus.tsx'),
	join(featuresDir, 'shell/OfflineShell.tsx'),
	join(featuresDir, 'shell/ConnectionStatusBar.tsx'),
	join(featuresDir, 'shell/apps/UnavailableAppPanel.tsx'),
] as const;

const BANNED = [
	/\bRedeem\b/,
	/\bDesktop Client\b/,
	/\bоблачный SPA\b/,
	/\bNative Desktop\b/,
	/\bENROLL_BASE\b/,
	/\bAPP_BASE\b/,
	/\bportalctl\b/,
	/\bHandoff conf\b/,
	/\bUpdater:\b/,
	/\bsoft-отозвана\b/,
	/\bOTA denylist\b/,
];

describe('launcher Russian UX copy', () => {
	it('keeps primary screen copy user-facing RU', () => {
		for (const path of SCREEN_FILES) {
			const text = readFileSync(path, 'utf8');
			for (const re of BANNED) {
				expect(text, `${path} matches ${re}`).not.toMatch(re);
			}
		}
	});

	it('home activation drop is Russian primary CTA without duplicate welcome/modes', () => {
		const home = readFileSync(join(homeDir, 'HomeScreen.tsx'), 'utf8');
		expect(home).toContain('Импортировать пакет места');
		expect(home).toContain('Импортировать файл доступа');
		expect(home).toContain('eliteew-seat');
		expect(home).toContain('eliteew-*.ecap');
		expect(home).toContain('Подключить по сети вручную');
		expect(home).toContain('Подготовить запрос устройства');
		expect(home).not.toContain('Добро пожаловать');
		expect(home).not.toContain('modeLabelRu');
		expect(home).not.toContain('home-aside');
		expect(home).not.toContain('client-offline-ai');
	});

	it('tunnel offers paste and disconnect when needed', () => {
		const tunnel = readFileSync(
			join(featuresDir, 'tunnel/TunnelScreen.tsx'),
			'utf8'
		);
		expect(tunnel).toContain('Вставить из буфера');
		expect(tunnel).toContain('Отключить');
		expect(tunnel).toContain('Перетащите сюда');
		expect(tunnel).toContain('WireGuard for Windows');
		expect(tunnel).toContain('Открыть папку с конфигом');
		expect(tunnel).toContain('без системного VPN');
		expect(tunnel).toContain('transportMode');
		expect(tunnel).toContain('Пропуск канала недоступен');
	});

	it('license activates instead of redeem jargon', () => {
		const license = readFileSync(
			join(featuresDir, 'license/LicenseScreen.tsx'),
			'utf8'
		);
		expect(license).toContain('Активировать');
		expect(license).toContain('Активация лицензии');
	});

	it('shell status bar is Russian aria-labelled', () => {
		const bar = readFileSync(
			join(featuresDir, 'shell/ConnectionStatusBar.tsx'),
			'utf8'
		);
		expect(bar).toContain('Состояние подключения');
	});
});
