import { describe, expect, it } from 'vitest';
import type { DesktopWindowStyle } from '@/types/profile';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellEmbeddedAppRootClassName,
	getDesktopShellFooterStripClassName,
	getDesktopShellHeaderStripClassName,
	getDesktopShellSettingsFormCardClassName,
	getDesktopShellSettingsMainColumnClassName,
} from '../desktopVisualSystem';

const ALL_WINDOW_STYLES: DesktopWindowStyle[] = [
	'glass',
	'framed',
	'minimal',
	'noir',
	'neon',
	'paper',
	'aurora',
	'chameleon',
	'premium',
];

describe('getDesktopShellSettingsFormCardClassName', () => {
	it('returns a non-empty class string for every window preset', () => {
		for (const style of ALL_WINDOW_STYLES) {
			const cls = getDesktopShellSettingsFormCardClassName(style);
			expect(cls.trim().length).toBeGreaterThan(0);
		}
	});

	it('uses distinct surfaces for strong presets (neon, paper, chameleon)', () => {
		const neon = getDesktopShellSettingsFormCardClassName('neon');
		const paper = getDesktopShellSettingsFormCardClassName('paper');
		const chameleon = getDesktopShellSettingsFormCardClassName('chameleon');
		expect(neon).not.toBe(paper);
		expect(paper).not.toBe(chameleon);
		expect(neon).toContain('rgb(var(--desktop-accent-rgb)');
		expect(paper).toContain('desktop-paper');
		expect(chameleon).toContain('desktop-chrome-chameleon-card-bg');
		expect(neon).not.toContain('backdrop-blur');
		expect(chameleon).not.toContain('desktop-window-chameleon');
	});
});

describe('getDesktopShellContentPanelClassName', () => {
	it('keeps strong presets distinct (same family as Settings cards)', () => {
		const neon = getDesktopShellContentPanelClassName('neon');
		const premium = getDesktopShellContentPanelClassName('premium');
		const paper = getDesktopShellContentPanelClassName('paper');
		expect(neon).not.toBe(premium);
		expect(premium).not.toBe(paper);
		expect(neon).toContain('rgb(var(--desktop-accent-rgb)');
		expect(premium).toContain('desktop-chrome-premium-card-bg');
		expect(paper).toContain('desktop-paper');
		expect(getDesktopShellContentPanelClassName('neon')).toBe(
			getDesktopShellSettingsFormCardClassName('neon')
		);
		expect(getDesktopShellContentPanelClassName('premium')).toBe(
			getDesktopShellSettingsFormCardClassName('premium')
		);
	});

	it('does not collapse premium into glass-tier surface', () => {
		const glass = getDesktopShellContentPanelClassName('glass');
		const premium = getDesktopShellContentPanelClassName('premium');
		expect(premium).not.toBe(glass);
		expect(premium).not.toContain('glass-bg-strong');
	});
});

describe('getDesktopShellEmbeddedAppRootClassName', () => {
	it('stays transparent so window content chrome can show through', () => {
		const cls = getDesktopShellEmbeddedAppRootClassName();
		expect(cls).toContain('bg-transparent');
		expect(cls).not.toContain('desktop-surface-app');
	});
});

describe('getDesktopShellSettingsMainColumnClassName', () => {
	it('returns a non-empty class string for every window preset', () => {
		for (const style of ALL_WINDOW_STYLES) {
			const cls = getDesktopShellSettingsMainColumnClassName(style);
			expect(cls.trim().length).toBeGreaterThan(0);
		}
	});

	it('uses distinct opaque columns for neon vs paper vs chameleon', () => {
		const neon = getDesktopShellSettingsMainColumnClassName('neon');
		const paper = getDesktopShellSettingsMainColumnClassName('paper');
		const chameleon = getDesktopShellSettingsMainColumnClassName('chameleon');
		expect(neon).not.toBe(paper);
		expect(paper).not.toBe(chameleon);
		expect(neon).toContain('rgb(var(--desktop-accent-rgb)');
		expect(paper).toContain('desktop-paper');
		expect(chameleon).toContain('desktop-chrome-chameleon-content-bg');
		expect(neon).not.toContain('backdrop-blur');
		expect(chameleon).not.toContain('desktop-window-chameleon');
	});

	it('uses theme chrome CSS vars (not hardcoded dark RGB) for premium/noir/neon', () => {
		const premium = getDesktopShellSettingsMainColumnClassName('premium');
		const noir = getDesktopShellSettingsMainColumnClassName('noir');
		const neon = getDesktopShellSettingsMainColumnClassName('neon');
		expect(premium).toContain('desktop-chrome-premium-content-bg');
		expect(noir).toContain('desktop-chrome-noir-content-bg');
		expect(neon).toContain('desktop-chrome-neon-content-bg');
		expect(premium).not.toContain('rgb(36,30,48)');
		expect(noir).not.toContain('rgb(24,24,30)');
		expect(neon).not.toContain('rgb(10,12,20)');
	});

	it('paints chrome gradients via background-image (not Tailwind bg color util)', () => {
		const premium = getDesktopShellSettingsMainColumnClassName('premium');
		const header = getDesktopShellHeaderStripClassName('premium');
		expect(premium).toContain(
			'[background-image:var(--desktop-chrome-premium-content-bg)]'
		);
		expect(premium).not.toContain('bg-(--desktop-chrome-premium-content-bg)');
		expect(header).toContain(
			'[background-image:var(--desktop-chrome-premium-content-bg)]'
		);
	});
});

describe('getDesktopShellHeaderStripClassName', () => {
	it('mirrors footer strip borders for every window preset', () => {
		for (const style of ALL_WINDOW_STYLES) {
			const header = getDesktopShellHeaderStripClassName(style);
			const footer = getDesktopShellFooterStripClassName(style);
			expect(header).toContain('border-b');
			expect(header).not.toMatch(/\bborder-t\b/);
			expect(
				header
					.replace(/\bborder-b-2\b/g, 'border-t-2')
					.replace(/\bborder-b\b/g, 'border-t')
			).toBe(footer);
		}
	});

	it('keeps premium header on chrome tokens (light/dark packs)', () => {
		const header = getDesktopShellHeaderStripClassName('premium');
		expect(header).toContain('desktop-chrome-premium-content-bg');
		expect(header).not.toContain('glass-bg-strong');
	});
});
