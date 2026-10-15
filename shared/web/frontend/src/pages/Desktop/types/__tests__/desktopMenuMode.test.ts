/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize + default contract for multimodal Start Menu mode.
 *
 * Related:
 * - `types/profile.ts`, `types/desktopStartMenu.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_UI_PREFERENCES,
	normalizeDesktopMenuMode,
} from '@/types/profile';

describe('normalizeDesktopMenuMode', () => {
	it('defaults empty and unknown to legacy', () => {
		expect(normalizeDesktopMenuMode(null)).toBe('legacy');
		expect(normalizeDesktopMenuMode('')).toBe('legacy');
		expect(normalizeDesktopMenuMode('raycast')).toBe('legacy');
	});

	it('accepts the three orchestrator modes', () => {
		expect(normalizeDesktopMenuMode('legacy')).toBe('legacy');
		expect(normalizeDesktopMenuMode('command_console')).toBe('command_console');
		expect(normalizeDesktopMenuMode('workspace_dashboard')).toBe(
			'workspace_dashboard'
		);
	});

	it('DEFAULT_UI_PREFERENCES uses legacy for additive rollout', () => {
		expect(DEFAULT_UI_PREFERENCES.desktop_menu_mode).toBe('legacy');
	});
});
