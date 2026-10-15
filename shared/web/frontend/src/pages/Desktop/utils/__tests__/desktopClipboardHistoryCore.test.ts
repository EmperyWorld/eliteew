/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for pure clipboard history mutations and classification.
 *
 * Related:
 * - utils/desktopClipboardHistoryCore.ts
 */

import { describe, expect, it } from 'vitest';
import {
	classifyClipboardPersistScope,
	DESKTOP_CLIPBOARD_MAX_PINNED,
	filterClipboardHistoryForSearch,
	mergeClipboardHistoryCapture,
	sortClipboardHistoryItems,
	toggleClipboardHistoryPin,
} from '../desktopClipboardHistoryCore';
import {
	DESKTOP_CLIPBOARD_SHELL_MAX_STRING,
	type DesktopClipboardHistoryItem,
} from '../clipboardHistoryPersistence';

describe('desktopClipboardHistoryCore', () => {
	it('classifies JWT-like text as session-only persist scope', () => {
		expect(
			classifyClipboardPersistScope({
				type: 'text',
				content: 'eyJhbGciOiJIUzI1NiIs.abc.def',
			})
		).toBe('session');
	});

	it('merges duplicate unpinned content by bumping timestamp', () => {
		const first = mergeClipboardHistoryCapture([], {
			type: 'text',
			content: 'hello',
		});
		const second = mergeClipboardHistoryCapture(first, {
			type: 'text',
			content: 'hello',
		});
		expect(second).toHaveLength(1);
		expect(second[0]?.content).toBe('hello');
	});

	it('caps pinned items', () => {
		let history: DesktopClipboardHistoryItem[] = Array.from(
			{ length: DESKTOP_CLIPBOARD_MAX_PINNED },
			(_, i) => ({
				id: `pin-${i}`,
				type: 'text' as const,
				content: `item-${i}`,
				timestamp: new Date(),
				pinned: true,
			})
		);
		history = mergeClipboardHistoryCapture(history, {
			type: 'text',
			content: 'new-unpinned',
		});
		const unpinnedId = history.find(
			(item) => item.content === 'new-unpinned'
		)?.id;
		expect(unpinnedId).toBeDefined();
		if (!unpinnedId) {
			throw new Error('expected unpinned item');
		}
		const toggled = toggleClipboardHistoryPin(history, unpinnedId);
		expect(toggled.filter((item) => item.pinned)).toHaveLength(
			DESKTOP_CLIPBOARD_MAX_PINNED
		);
	});

	it('filters search across preview and source fields', () => {
		const items = [
			{
				id: '1',
				type: 'text' as const,
				content: 'alpha',
				preview: 'beta',
				source: 'os',
				timestamp: new Date(),
				pinned: false,
			},
		];
		expect(filterClipboardHistoryForSearch(items, 'beta')).toHaveLength(1);
		expect(filterClipboardHistoryForSearch(items, 'missing')).toHaveLength(0);
	});

	it('sorts pinned items before recency', () => {
		const older = new Date('2026-01-01T00:00:00Z');
		const newer = new Date('2026-02-01T00:00:00Z');
		const sorted = sortClipboardHistoryItems([
			{
				id: 'new-unpinned',
				type: 'text',
				content: 'b',
				timestamp: newer,
				pinned: false,
			},
			{
				id: 'old-pinned',
				type: 'text',
				content: 'a',
				timestamp: older,
				pinned: true,
			},
		]);
		expect(sorted[0]?.id).toBe('old-pinned');
	});

	it('marks oversized inline image data URLs as session-only', () => {
		expect(
			classifyClipboardPersistScope({
				type: 'image',
				content: `data:image/png;base64,${'x'.repeat(
					DESKTOP_CLIPBOARD_SHELL_MAX_STRING
				)}`,
			})
		).toBe('session');
	});
});
