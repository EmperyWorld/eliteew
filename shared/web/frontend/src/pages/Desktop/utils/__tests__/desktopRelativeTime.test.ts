/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for shared desktop relative-time formatter.
 *
 * Related:
 * - src/pages/Desktop/utils/desktopRelativeTime.ts
 */

import { describe, expect, it } from 'vitest';
import { createDesktopUiNotificationHubTFunction } from '../../__fixtures__/desktopTestHelpers';

import { formatDesktopRelativeTimeAgo } from '@/pages/Desktop/utils/desktopRelativeTime';

describe('formatDesktopRelativeTimeAgo', () => {
	const t = createDesktopUiNotificationHubTFunction();

	it('returns justNow under one minute', () => {
		const now = Date.parse('2026-06-22T12:00:30Z');
		const date = new Date('2026-06-22T12:00:00Z');
		expect(formatDesktopRelativeTimeAgo(date, t, now)).toBe('timeAgo.justNow');
	});

	it('returns minutes bucket', () => {
		const now = Date.parse('2026-06-22T12:05:00Z');
		const date = new Date('2026-06-22T12:00:00Z');
		expect(formatDesktopRelativeTimeAgo(date, t, now)).toBe(
			'timeAgo.minutes:5'
		);
	});

	it('returns hours bucket', () => {
		const now = Date.parse('2026-06-22T15:00:00Z');
		const date = new Date('2026-06-22T12:00:00Z');
		expect(formatDesktopRelativeTimeAgo(date, t, now)).toBe('timeAgo.hours:3');
	});

	it('returns days bucket', () => {
		const now = Date.parse('2026-06-24T12:00:00Z');
		const date = new Date('2026-06-22T12:00:00Z');
		expect(formatDesktopRelativeTimeAgo(date, t, now)).toBe('timeAgo.days:2');
	});
});
