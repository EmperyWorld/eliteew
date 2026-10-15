/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for clickable EwaFile output-surface list payload coercion.
 *
 * Invariants:
 * - Rows without unified content id are discarded; helper performs no side effects.
 *
 * Related:
 * - ../companionFileListSurfaceUi
 */

import { describe, expect, it } from 'vitest';

import { coerceCompanionFileListSurfacePayload } from '../companionFileListSurfaceUi';

describe('companionFileListSurfaceUi', () => {
	it('normalizes file-list payload aliases', () => {
		expect(
			coerceCompanionFileListSurfacePayload({
				title: ' EwaFile ',
				query: ' notes ',
				browse_all: 'false',
				row_count: '3',
				items: [
					{
						unified_content_id: ' uc-1 ',
						name: ' Notes.md ',
						content_type: 'document',
						mime_type: 'text/markdown',
						updated_at: 'today',
						snippet: ' hello ',
					},
					{ title: 'missing id' },
				],
			})
		).toEqual({
			title: 'EwaFile',
			query: 'notes',
			browseAll: false,
			rowCount: 3,
			items: [
				{
					unifiedContentId: 'uc-1',
					title: 'Notes.md',
					contentType: 'document',
					mimeType: 'text/markdown',
					updatedAt: 'today',
					snippet: 'hello',
				},
			],
		});
	});

	it('falls back row count to usable item count', () => {
		expect(
			coerceCompanionFileListSurfacePayload({
				items: [{ unifiedContentId: 'uc-1', title: 'One' }],
			}).rowCount
		).toBe(1);
	});
});
