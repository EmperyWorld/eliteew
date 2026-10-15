/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for taskbar laser-pointer safe-zone hit testing.
 */
import { describe, expect, it } from 'vitest';
import { isOverDesktopTaskbarDismissSafeZone } from '@/pages/Desktop/utils/desktopTaskbarDismissSafeZone';

function mount(label: string, attrs: Record<string, string> = {}): HTMLElement {
	const el = document.createElement('div');
	for (const [key, value] of Object.entries(attrs)) {
		el.setAttribute(key, value);
	}
	el.textContent = label;
	document.body.appendChild(el);
	return el;
}

describe('isOverDesktopTaskbarDismissSafeZone', () => {
	it('returns false for null and desktop wallpaper targets', () => {
		expect(isOverDesktopTaskbarDismissSafeZone(null)).toBe(false);
		const wallpaper = mount('wallpaper');
		expect(isOverDesktopTaskbarDismissSafeZone(wallpaper)).toBe(false);
		wallpaper.remove();
	});

	it('matches taskbar strip, flyouts, Start panel, pinned menu, and tooltips', () => {
		const cases: Array<[string, Record<string, string>]> = [
			['strip', { 'data-desktop-taskbar-strip': 'true' }],
			['flyout', { 'data-taskbar-flyout': 'true' }],
			['start', { id: 'start-menu-panel' }],
			['notifications', { id: 'notification-center-panel' }],
			['pinned', { 'data-taskbar-pinned-menu': 'true' }],
			['tray', { 'data-tray-popup': 'true' }],
			['tooltip', { role: 'tooltip' }],
		];

		for (const [label, attrs] of cases) {
			const root = mount(`${label}-root`, attrs);
			const child = mount(`${label}-child`);
			root.appendChild(child);
			expect(isOverDesktopTaskbarDismissSafeZone(child)).toBe(true);
			root.remove();
		}
	});

	it('matches nested descendants inside safe zones', () => {
		const start = mount('start-root', { id: 'start-menu-panel' });
		const inner = mount('start-inner');
		start.appendChild(inner);
		expect(isOverDesktopTaskbarDismissSafeZone(inner)).toBe(true);
		start.remove();
	});
});
