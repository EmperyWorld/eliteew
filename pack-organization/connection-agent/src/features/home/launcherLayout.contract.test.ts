/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock fluid modular launcher — full-bleed top hero; stage fills width;
 * 2-col from ~720px; ultrawide ≥1600px uses ≥3 columns.
 *
 * Related:
 * - src/styles/tokens.css
 * - src/features/chrome/chrome.css
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const homeDir = dirname(fileURLToPath(import.meta.url));
const root = join(homeDir, '../..');
const tokens = readFileSync(join(root, 'styles/tokens.css'), 'utf8');
const base = readFileSync(join(root, 'styles/base.css'), 'utf8');
const chrome = readFileSync(join(root, 'features/chrome/chrome.css'), 'utf8');
const homeCss = readFileSync(join(root, 'features/home/home.css'), 'utf8');
const tunnelCss = readFileSync(
	join(root, 'features/tunnel/tunnel.css'),
	'utf8'
);
const licenseCss = readFileSync(
	join(root, 'features/license/license.css'),
	'utf8'
);
const launcherCss = readFileSync(
	join(root, 'features/launcher/launcher.css'),
	'utf8'
);
const shellCss = readFileSync(join(root, 'features/shell/shell.css'), 'utf8');
const updater = readFileSync(
	join(root, 'features/updater/UpdaterStatus.tsx'),
	'utf8'
);
const profile = readFileSync(
	join(root, 'features/profile-menu/ProfileMenu.tsx'),
	'utf8'
);
const offline = readFileSync(
	join(root, 'features/shell/OfflineShell.tsx'),
	'utf8'
);
const app = readFileSync(join(root, 'App.tsx'), 'utf8');
const shell = readFileSync(join(root, 'features/shell/ShellStep.tsx'), 'utf8');
const home = readFileSync(join(root, 'features/home/HomeScreen.tsx'), 'utf8');
const license = readFileSync(
	join(root, 'features/license/LicenseScreen.tsx'),
	'utf8'
);
const hero = readFileSync(
	join(root, 'features/chrome/LauncherHero.tsx'),
	'utf8'
);
const rail = readFileSync(join(root, 'features/chrome/StepRail.tsx'), 'utf8');

describe('launcher fluid modular layout', () => {
	it('uses expanding shell max instead of a fixed skinny column', () => {
		expect(tokens).toContain('--dc-shell-max');
		expect(tokens).not.toMatch(/--dc-shell-max:\s*40rem/);
		expect(tokens).not.toMatch(/--dc-shell-max:\s*42rem/);
		expect(chrome).not.toMatch(/\.shell\s*\{[^}]*max-width:\s*40rem/s);
		expect(chrome).toMatch(/min-width:\s*720px/);
		expect(chrome).toMatch(/--dc-shell-max:\s*100%/);
		expect(chrome).toContain('shell-split');
		expect(chrome).toContain('data-layout="full-top"');
		expect(chrome).toContain('hero-inner');
		expect(chrome).toContain('.hero[data-layout="full-top"]::before');
		expect(chrome).toMatch(/\.hero-nav\s*\{[^}]*border-radius:\s*14px/s);
		expect(chrome).toContain('dc-stage-in');
		expect(chrome).toContain('step-rail::before');
		expect(chrome).toContain('prefers-reduced-motion');
		expect(base).toContain('status-banner');
		expect(homeCss).toContain('home-panel');
		expect(homeCss).toContain('home-panel-activation');
		expect(homeCss).toContain('home-prepare-request');
		expect(homeCss).not.toMatch(/\.mode-legend\s*\{/);
		expect(homeCss).not.toMatch(/min-width:\s*1600px/);
		expect(homeCss).not.toMatch(/repeat\(3,\s*minmax/);
		expect(tunnelCss).toContain('tunnel-panel');
		expect(tunnelCss).toMatch(/min-width:\s*720px/);
		expect(tunnelCss).toMatch(/min-width:\s*1600px/);
		expect(tunnelCss).toContain('tunnel-aside-actions');
		expect(tunnelCss).not.toMatch(
			/\.tunnel-aside\s*\{[^}]*display:\s*contents/s
		);
		expect(licenseCss).toContain('license-panel');
		expect(licenseCss).toMatch(/min-width:\s*720px/);
		expect(licenseCss).toMatch(/min-width:\s*1600px/);
		expect(licenseCss).toContain('license-help');
		expect(licenseCss).not.toMatch(
			/\.license-aside\s*\{[^}]*display:\s*contents/s
		);
		expect(chrome).toContain('shell-tertiary');
		expect(chrome).toMatch(
			/\.shell-split\[data-layout="shell"\]\s*\{[^}]*minmax\(22rem,\s*1\.1fr\)[^}]*minmax\(16rem,\s*0\.9fr\)/s
		);
		expect(shell).toContain('LicenseSummaryPanel');
		expect(shellCss).toContain('license-summary');
		expect(launcherCss).toContain('launcher-panel');
		expect(shellCss).toContain('shell-dashboard');
		expect(shellCss).toContain('shell-status-rail');
		expect(shellCss).toContain('app-catalog-action');
		expect(base).toContain("data-state='idle'");
		expect(base).toContain("data-state='available'");
		expect(base).toContain("data-state='restart'");
	});

	it('wires modular chrome and split regions in components', () => {
		expect(app).toContain('shell-stage');
		expect(app).toContain('data-step={step}');
		expect(app).toContain('LauncherHero');
		expect(app).toContain('StepRail');
		expect(app).toContain('HubShell');
		expect(app).toContain('WelcomeTour');
		expect(app).toContain('ActivationScreen');
		expect(app).toContain('styles/tokens.css');
		expect(app).not.toContain('App.css');
		expect(app).not.toMatch(/from ['"].*ShellStep['"]/);
		expect(app).not.toMatch(/<ShellStep\b/);
		expect(hero).toContain('Рабочий стол EliteEW');
		expect(hero).toContain('data-layout="full-top"');
		expect(hero).toContain('hero-inner');
		expect(hero).toContain('hero-meta');
		expect(rail).toContain('step-rail');
		expect(shell).toContain('shell-split');
		expect(shell).toContain('shell-primary');
		expect(shell).toContain('shell-dashboard');
		expect(shell).toContain('shell-status-rail');
		expect(shell).toContain('LicenseSummaryPanel');
		expect(shell).toContain('shell-secondary');
		expect(shell).toContain('shell-tertiary');
		expect(home).toContain('home-panel');
		expect(home).toContain('home-panel-activation');
		expect(home).toContain('drop-zone-primary');
		expect(home).not.toContain('Добро пожаловать');
		expect(home).not.toContain('home-aside');
		expect(home).not.toContain('mode-legend-card');
		expect(home).not.toContain('modeLabelRu');
		expect(license).toContain('license-main');
		expect(license).toContain('license-aside');
		expect(license).toContain('license-help');
		expect(updater).toContain('data-state={state}');
		expect(profile).toContain('profile-panel');
		expect(offline).toContain('app-catalog-action');
	});
});
