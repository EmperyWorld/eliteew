import { describe, expect, it } from 'vitest';
import {
	ADVANCED_TAB_IDS,
	PRIMARY_TAB_ORDER,
} from '../desktopSettingsShared.types';
import {
	isDesktopSettingsTextEntryTarget,
	resolveDesktopSettingsTabFromDigitKey,
	resolveDesktopSettingsTabFromKeyboard,
} from '../desktopSettingsTablistKeyboard';

describe('desktopSettingsTablistKeyboard', () => {
	it('resolves arrow and home/end navigation', () => {
		expect(resolveDesktopSettingsTabFromKeyboard('chrome', 'ArrowRight')).toBe(
			'widgets'
		);
		expect(resolveDesktopSettingsTabFromKeyboard('chrome', 'ArrowLeft')).toBe(
			'icons'
		);
		expect(resolveDesktopSettingsTabFromKeyboard('personalize', 'End')).toBe(
			'widgets'
		);
		expect(resolveDesktopSettingsTabFromKeyboard('performance', 'Home')).toBe(
			'shell'
		);
	});

	it('maps primary digits always and advanced digits only after disclosure', () => {
		expect(resolveDesktopSettingsTabFromDigitKey('3', false)).toBe('chrome');
		expect(resolveDesktopSettingsTabFromDigitKey('4', false)).toBe('widgets');
		expect(resolveDesktopSettingsTabFromDigitKey('5', false)).toBeNull();
		expect(resolveDesktopSettingsTabFromDigitKey('5', true)).toBe('shell');
		expect(resolveDesktopSettingsTabFromDigitKey('6', true)).toBe(
			'performance'
		);
		expect(PRIMARY_TAB_ORDER).toHaveLength(4);
		expect(ADVANCED_TAB_IDS).toEqual(['shell', 'performance']);
	});

	it('detects text entry targets', () => {
		const input = document.createElement('input');
		expect(isDesktopSettingsTextEntryTarget(input)).toBe(true);
		const button = document.createElement('button');
		expect(isDesktopSettingsTextEntryTarget(button)).toBe(false);
	});
});
