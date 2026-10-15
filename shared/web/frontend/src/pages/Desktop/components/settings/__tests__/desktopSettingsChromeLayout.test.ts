/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P6 lock — Settings sidebar vs stacked tabs from panel width, not viewport.
 *
 * Invariants:
 * - Narrow panel / unmeasured / embedded-mobile → stacked.
 * - Wide panel (≥ DESKTOP_SETTINGS_SIDEBAR_MIN_WIDTH_PX) → sidebar.
 *
 * Related:
 * - settings/desktopSettingsChromeLayout.ts
 */

import { describe, expect, it } from 'vitest';
import {
	DESKTOP_SETTINGS_SIDEBAR_MIN_WIDTH_PX,
	resolveDesktopSettingsTabsDesktopLayout,
} from '../desktopSettingsChromeLayout';

describe('resolveDesktopSettingsTabsDesktopLayout (P6)', () => {
	it('forces stacked when embedded mobile layout is set', () => {
		expect(
			resolveDesktopSettingsTabsDesktopLayout({
				panelWidthPx: 1200,
				embeddedMobileLayout: true,
			})
		).toBe(false);
	});

	it('forces stacked until panel width is measured', () => {
		expect(
			resolveDesktopSettingsTabsDesktopLayout({
				panelWidthPx: 0,
				embeddedMobileLayout: false,
			})
		).toBe(false);
	});

	it('uses stacked chrome below the sidebar threshold', () => {
		expect(
			resolveDesktopSettingsTabsDesktopLayout({
				panelWidthPx: DESKTOP_SETTINGS_SIDEBAR_MIN_WIDTH_PX - 1,
				embeddedMobileLayout: false,
			})
		).toBe(false);
	});

	it('uses sidebar chrome at and above the threshold', () => {
		expect(
			resolveDesktopSettingsTabsDesktopLayout({
				panelWidthPx: DESKTOP_SETTINGS_SIDEBAR_MIN_WIDTH_PX,
				embeddedMobileLayout: false,
			})
		).toBe(true);
		expect(
			resolveDesktopSettingsTabsDesktopLayout({
				panelWidthPx: 960,
				embeddedMobileLayout: false,
			})
		).toBe(true);
	});

	it('Wave 4 @≤390: Settings stays stacked (no clipped sidebar rail)', () => {
		expect(DESKTOP_SETTINGS_SIDEBAR_MIN_WIDTH_PX).toBeGreaterThan(390);
		expect(
			resolveDesktopSettingsTabsDesktopLayout({
				panelWidthPx: 390,
				embeddedMobileLayout: false,
			})
		).toBe(false);
		expect(
			resolveDesktopSettingsTabsDesktopLayout({
				panelWidthPx: 360,
				embeddedMobileLayout: false,
			})
		).toBe(false);
	});
});
