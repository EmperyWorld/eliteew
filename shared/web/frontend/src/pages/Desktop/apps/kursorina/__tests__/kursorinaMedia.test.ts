/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract locks for Kursorina library image detection → content download path.
 */

import { describe, expect, it } from 'vitest';
import {
	contentDownloadApiPath,
	isLibraryImageResult,
	libraryImageTitle,
	listLibraryImageResults,
} from '../kursorinaMedia';
import type { MissionResultItem } from '../types';

const PNG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function item(
	partial: Partial<MissionResultItem> & Pick<MissionResultItem, 'kind'>
): MissionResultItem {
	return {
		title: '',
		ref: '',
		snippet: '',
		...partial,
	};
}

describe('kursorinaMedia', () => {
	it('maps UUID ref to content download API path', () => {
		expect(contentDownloadApiPath(PNG_ID)).toBe(
			`/api/v1/content/${PNG_ID}/download`
		);
		expect(contentDownloadApiPath('not-a-uuid')).toBeNull();
		expect(contentDownloadApiPath('https://evil.example/x.png')).toBeNull();
	});

	it('detects PNG library artifacts from save_binary extract shape', () => {
		const png = item({
			kind: 'library',
			ref: PNG_ID,
			title: `cash_flow.png bytes=4096 content_id=${PNG_ID}`,
			snippet: `cash_flow.png bytes=4096 content_id=${PNG_ID}`,
		});
		expect(isLibraryImageResult(png)).toBe(true);
		expect(libraryImageTitle(png)).toBe('cash_flow.png');
	});

	it('rejects non-image library markdown and web refs', () => {
		expect(
			isLibraryImageResult(
				item({
					kind: 'library',
					ref: PNG_ID,
					title: 'notes.md',
					snippet: 'markdown body',
				})
			)
		).toBe(false);
		expect(
			isLibraryImageResult(
				item({
					kind: 'web',
					ref: 'https://example.com/chart.png',
					title: 'chart.png',
					snippet: 'png',
				})
			)
		).toBe(false);
	});

	it('dedupes gallery list by content id', () => {
		const a = item({
			kind: 'library',
			ref: PNG_ID,
			title: 'a.png',
			snippet: 'a.png bytes=1',
		});
		const b = item({
			kind: 'library',
			ref: PNG_ID,
			title: 'a.png duplicate',
			snippet: 'a.png bytes=1',
		});
		expect(listLibraryImageResults([a, b])).toHaveLength(1);
	});
});
