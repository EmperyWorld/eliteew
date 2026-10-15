/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for Notification Hub filter active detection and Escape guard.
 *
 * Invariants:
 * - Covers window vs panel filter axes independently.
 *
 * Related:
 * - ../notificationHubFilterState.ts
 */

import { describe, expect, it } from 'vitest';

import {
	notificationHubPanelFiltersActive,
	notificationHubWindowFiltersActive,
	resolveNotificationHubEffectiveGroupMode,
	resolveNotificationHubEscapeAction,
	shouldResetNotificationHubFiltersOnEscape,
} from '../notificationHubFilterState';

describe('notificationHubFilterState', () => {
	it('detects active window filters', () => {
		expect(notificationHubWindowFiltersActive('', 'all', 'all')).toBe(false);
		expect(notificationHubWindowFiltersActive('  hello ', 'all', 'all')).toBe(
			true
		);
		expect(notificationHubWindowFiltersActive('', 'gaf_chat', 'all')).toBe(
			true
		);
		expect(notificationHubWindowFiltersActive('', 'all', 'unread')).toBe(true);
	});

	it('detects active panel filters', () => {
		expect(notificationHubPanelFiltersActive('all', 'all')).toBe(false);
		expect(notificationHubPanelFiltersActive('unread', 'all')).toBe(true);
		expect(notificationHubPanelFiltersActive('all', 'warning')).toBe(true);
	});

	it('blocks Escape reset inside text inputs', () => {
		const input = document.createElement('input');
		expect(shouldResetNotificationHubFiltersOnEscape(input)).toBe(false);
		expect(shouldResetNotificationHubFiltersOnEscape(document.body)).toBe(true);
	});

	it('resolves Escape action for panel flyout vs filter reset', () => {
		expect(
			resolveNotificationHubEscapeAction({
				filtersActive: true,
				density: 'panel',
				hasRequestClose: true,
				target: document.body,
			})
		).toBe('reset-filters');

		expect(
			resolveNotificationHubEscapeAction({
				filtersActive: false,
				density: 'panel',
				hasRequestClose: true,
				target: document.body,
			})
		).toBe('close-panel');

		expect(
			resolveNotificationHubEscapeAction({
				filtersActive: false,
				density: 'window',
				hasRequestClose: false,
				target: document.body,
			})
		).toBe('none');

		expect(
			resolveNotificationHubEscapeAction({
				filtersActive: false,
				density: 'window',
				hasRequestClose: true,
				target: document.body,
			})
		).toBe('close-panel');
	});

	it('forces type grouping when window virtual feed is active', () => {
		expect(resolveNotificationHubEffectiveGroupMode('source', true)).toBe(
			'type'
		);
		expect(resolveNotificationHubEffectiveGroupMode('source', false)).toBe(
			'source'
		);
		expect(resolveNotificationHubEffectiveGroupMode('type', true)).toBe('type');
	});
});
