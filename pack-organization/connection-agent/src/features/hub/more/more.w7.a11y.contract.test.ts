/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * W7 Journey a11y + sealed-chrome + program surface locks.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §3 / §5 / §8 W7
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MORE_PANELS } from '../../../lib/launcher/journey';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('Journey W7 a11y + sealed chrome (source)', () => {
	it('Identifying keeps aria-busy + reduced-motion CSS', () => {
		const screen = readFileSync(
			join(root, 'features/boot/IdentifyingScreen.tsx'),
			'utf8'
		);
		const css = readFileSync(
			join(root, 'features/boot/identifying.css'),
			'utf8'
		);
		expect(screen).toContain('aria-busy');
		expect(screen).toContain('aria-live');
		expect(css).toContain('prefers-reduced-motion');
	});

	it('Hub tablist is keyboard-roving with focus-visible + reduced-motion', () => {
		const shell = readFileSync(join(root, 'features/hub/HubShell.tsx'), 'utf8');
		const css = readFileSync(join(root, 'features/hub/hub.css'), 'utf8');
		expect(shell).toMatch(/role="tablist"/);
		expect(shell).toContain('ArrowRight');
		expect(shell).toContain('Home');
		expect(shell).toContain('End');
		expect(shell).toContain('tabIndex={tab === id ? 0 : -1}');
		expect(css).toContain('hub-tab:focus-visible');
		expect(css).toContain('prefers-reduced-motion');
	});

	it('Connection signal announces politely; License wipe dialog is modal', () => {
		const connection = readFileSync(
			join(root, 'features/hub/more/ConnectionPanel.tsx'),
			'utf8'
		);
		const license = readFileSync(
			join(root, 'features/hub/more/LicensePanel.tsx'),
			'utf8'
		);
		expect(connection).toContain('role="status"');
		expect(connection).toContain('aria-live="polite"');
		expect(license).toContain('role="dialog"');
		expect(license).toContain('aria-modal="true"');
		expect(license).toContain('aria-busy');
		expect(license).toContain("event.key === 'Escape'");
		expect(license).toContain('cancelRef');
	});

	it('Welcome respects reduced-motion; Activation has aria-label', () => {
		const welcomeCss = readFileSync(
			join(root, 'features/onboard/welcome.css'),
			'utf8'
		);
		const welcome = readFileSync(
			join(root, 'features/onboard/WelcomeTour.tsx'),
			'utf8'
		);
		const activation = readFileSync(
			join(root, 'features/activation/ActivationScreen.tsx'),
			'utf8'
		);
		expect(welcomeCss).toContain('prefers-reduced-motion');
		expect(welcome).toContain('aria-label="Знакомство с EliteEW"');
		expect(activation).toContain('aria-label="Активация EliteEW"');
	});

	it('sealed ProfileMenu hides service base URLs', () => {
		const profile = readFileSync(
			join(root, 'features/profile-menu/ProfileMenu.tsx'),
			'utf8'
		);
		expect(profile).toContain('isRetailSealedUi');
		expect(profile).toMatch(
			/!sealed\s*\?\s*\([\s\S]*?Адреса сервисов[\s\S]*?\)\s*:\s*null/
		);
		expect(profile).not.toMatch(
			/<details[\s\S]*?Адреса сервисов[\s\S]*?<\/details>\s*\{!sealed/
		);
	});

	it('Ещё MORE_PANELS surfaces are mounted under Hub', () => {
		const more = readFileSync(
			join(root, 'features/hub/tabs/MoreTab.tsx'),
			'utf8'
		);
		expect([...MORE_PANELS]).toEqual([
			'license',
			'connection',
			'network',
			'about',
			'site',
			'source_code',
			'mailto',
		]);
		expect(more).toContain('LicensePanel');
		expect(more).toContain('ConnectionPanel');
		expect(more).toContain('AboutContactsPanel');
		expect(more).toContain('onOpenSite');
		expect(more).toContain('onOpenSourceCode');
		expect(more).toContain('onOpenMailto');
	});
});
