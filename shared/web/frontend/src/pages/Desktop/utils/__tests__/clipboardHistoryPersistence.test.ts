/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for Clipboard Manager shell-state payload caps.
 *
 * Invariants:
 * - Oversized image data URLs must not be sent to `shell_state`.
 * - Text/html payloads are capped to the backend string budget.
 *
 * Related:
 * - src/pages/Desktop/utils/clipboardHistoryPersistence.ts
 */

import { describe, expect, it } from 'vitest';

import {
	DESKTOP_CLIPBOARD_SHELL_MAX_ITEMS,
	DESKTOP_CLIPBOARD_SHELL_MAX_STRING,
	clipboardItemsToShellRecords,
	shellRecordsToClipboardItems,
} from '../clipboardHistoryPersistence';

const timestamp = new Date('2026-05-28T00:00:00Z');

describe('clipboardHistoryPersistence', () => {
	it('drops oversized image data URLs before shell_state persistence', () => {
		const records = clipboardItemsToShellRecords([
			{
				id: 'image-big',
				type: 'image',
				content: `data:image/png;base64,${'x'.repeat(
					DESKTOP_CLIPBOARD_SHELL_MAX_STRING
				)}`,
				preview: `data:image/png;base64,${'x'.repeat(
					DESKTOP_CLIPBOARD_SHELL_MAX_STRING
				)}`,
				timestamp,
				pinned: false,
			},
			{
				id: 'text-ok',
				type: 'text',
				content: 'hello',
				timestamp,
				pinned: false,
			},
		]);

		expect(records).toHaveLength(1);
		expect(records[0]?.id).toBe('text-ok');
	});

	it('truncates large text/html payloads to backend string cap', () => {
		const records = clipboardItemsToShellRecords([
			{
				id: 'text-big',
				type: 'text',
				content: 'a'.repeat(DESKTOP_CLIPBOARD_SHELL_MAX_STRING + 10),
				timestamp,
				pinned: true,
			},
		]);

		expect(records[0]?.content).toHaveLength(
			DESKTOP_CLIPBOARD_SHELL_MAX_STRING
		);
		expect(records[0]?.pinned).toBe(true);
	});

	it('caps item count and hydrates timestamp strings back to Dates', () => {
		const items = Array.from(
			{ length: DESKTOP_CLIPBOARD_SHELL_MAX_ITEMS + 2 },
			(_, index) => ({
				id: `text-${index}`,
				type: 'text' as const,
				content: `item ${index}`,
				timestamp,
				pinned: false,
			})
		);

		const records = clipboardItemsToShellRecords(items);
		const hydrated = shellRecordsToClipboardItems(records);

		expect(records).toHaveLength(DESKTOP_CLIPBOARD_SHELL_MAX_ITEMS);
		expect(hydrated[0]?.timestamp).toBeInstanceOf(Date);
	});

	it('excludes session-scoped items from shell_state records', () => {
		const records = clipboardItemsToShellRecords([
			{
				id: 'session-only',
				type: 'text',
				content: 'secret-token',
				timestamp,
				pinned: false,
				persistScope: 'session',
			},
			{
				id: 'cloud',
				type: 'text',
				content: 'hello',
				timestamp,
				pinned: false,
				persistScope: 'cloud',
			},
		]);

		expect(records).toHaveLength(1);
		expect(records[0]?.id).toBe('cloud');
	});
});
