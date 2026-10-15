/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for shared Notification Center layout tokens.
 *
 * Invariants:
 * - Token strings stay stable enough for regression snapshots in UI polish waves.
 *
 * Related:
 * - ../notificationHubLayoutTokens.ts
 */

import { describe, expect, it } from 'vitest';

import { DESKTOP_TYPOGRAPHY } from '../../../constants';
import {
	NH_CENTER_HEADER_WRAP_CLASS,
	NH_CLEAR_CONFIRM_BODY_TEXT_CLASS,
	NH_EMPTY_CENTER_WRAP_CLASS,
	NH_EXT_FEED_END_CLASS,
	NH_FEED_GROUPS_STACK_CLASS,
	NH_PANEL_ANIMATED_LIST_CLASS,
	NH_PANEL_FILTER_BAR_CLASS,
	NH_PANEL_VIRTUAL_ESTIMATE_PX,
	NH_PANEL_VIRTUAL_SCROLL_CLASS,
	NH_SOURCE_GROUP_SUMMARY_CLASS,
	NH_TYPE_CHIP_ROW_CLASS,
	NH_VIRTUAL_FEED_HINT_CLASS,
	NH_WINDOW_VIRTUAL_ESTIMATE_PX,
	nhFilterChipButtonClass,
	nhItemMessageClass,
	nhItemMetaFooterClass,
	nhItemServerActionButtonClass,
	nhItemTitleClass,
	nhItemUnreadDotClass,
	nhMarkGroupReadButtonClass,
	nhSourceChipButtonClass,
	nhToolbarButtonClass,
	NH_QUICK_SETTINGS_ROOT_CLASS,
	NH_WINDOW_APP_SHELL_CLASS,
	nhExtensionSlotClass,
	nhItemCardShellClass,
	nhQuickSettingsToggleButtonClass,
} from '../notificationHubLayoutTokens';

describe('notificationHubLayoutTokens', () => {
	it('exports panel filter and empty state layout tokens', () => {
		expect(NH_PANEL_FILTER_BAR_CLASS).toContain('border-b');
		expect(NH_TYPE_CHIP_ROW_CLASS).toContain('flex-wrap');
		expect(NH_EMPTY_CENTER_WRAP_CLASS).toContain('justify-center');
	});

	it('exports group and flyout header tokens', () => {
		expect(NH_CENTER_HEADER_WRAP_CLASS).toContain('shrink-0');
		expect(NH_FEED_GROUPS_STACK_CLASS).toContain('space-y-4');
		expect(NH_SOURCE_GROUP_SUMMARY_CLASS).toContain('cursor-pointer');
	});

	it('exports hint typography tokens', () => {
		expect(NH_VIRTUAL_FEED_HINT_CLASS).toContain(
			DESKTOP_TYPOGRAPHY.shellMeta10
		);
		expect(NH_VIRTUAL_FEED_HINT_CLASS).toContain('desktop-text-muted');
	});

	it('maps filter chip and toolbar button classes', () => {
		expect(nhFilterChipButtonClass()).toContain(
			DESKTOP_TYPOGRAPHY.captionInherit
		);
		expect(nhSourceChipButtonClass()).toContain('truncate');
		expect(nhToolbarButtonClass('typo-body')).toContain('flex-1');
	});

	it('maps mark-group-read button shrink variant', () => {
		expect(nhMarkGroupReadButtonClass(false)).toContain('px-2');
		expect(nhMarkGroupReadButtonClass(true)).toContain('shrink-0');
	});

	it('maps item typography by density', () => {
		expect(nhItemTitleClass(true)).toBe(DESKTOP_TYPOGRAPHY.widgetTrackTitle);
		expect(nhItemTitleClass(false)).toContain('text-sm');
		expect(nhItemMessageClass(true)).toContain('line-clamp-2');
		expect(nhItemMessageClass(false)).toContain('line-clamp-3');
		expect(nhItemServerActionButtonClass(false)).toBe(DESKTOP_TYPOGRAPHY.meta);
		expect(nhItemUnreadDotClass(false)).toContain('h-1.5');
	});

	it('exports virtual list and extension slot tokens', () => {
		expect(NH_PANEL_VIRTUAL_SCROLL_CLASS).toContain('overflow-y-auto');
		expect(NH_PANEL_ANIMATED_LIST_CLASS).toContain('space-y-2');
		expect(NH_PANEL_VIRTUAL_ESTIMATE_PX).toBe(100);
		expect(NH_WINDOW_VIRTUAL_ESTIMATE_PX).toBe(128);
		expect(NH_EXT_FEED_END_CLASS).toContain('pt-1');
	});

	it('exports clear confirm and item footer tokens', () => {
		expect(NH_CLEAR_CONFIRM_BODY_TEXT_CLASS).toContain(
			'desktop-text-secondary'
		);
		expect(nhItemMetaFooterClass(true)).toContain('mt-1');
	});

	it('exports window shell and quick settings row tokens', () => {
		expect(NH_WINDOW_APP_SHELL_CLASS).toContain('min-h-0');
		expect(NH_QUICK_SETTINGS_ROOT_CLASS).toContain('space-y-3');
		expect(nhQuickSettingsToggleButtonClass()).toContain('px-2');
	});

	it('maps extension slots and item card shell', () => {
		expect(nhExtensionSlotClass('hubFeedEnd')).toContain('pt-1');
		expect(
			nhItemCardShellClass(false, 'bg-x', 'border-y', 'tone-z', true)
		).toContain('ring-1');
		expect(
			nhItemCardShellClass(false, 'bg-x', 'border-y', 'tone-z', false)
		).toContain('opacity-[0.9]');
	});
});
