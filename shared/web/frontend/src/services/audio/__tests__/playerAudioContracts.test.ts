/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for shared audio identity/download helpers.
 *
 * Invariants:
 * - Unified content id normalization supports snake_case and camelCase aliases.
 * - Inline download URLs always include `disposition=inline`.
 *
 * Related:
 * - src/services/audio/playerAudioContracts.ts
 */

import { describe, expect, it } from 'vitest';

import {
	buildContentDownloadUrlWithDisposition,
	buildPlayerAudioAsset,
	isUnifiedContentReferenceMissing,
	normalizeUnifiedContentId,
	unifiedContentAvailability,
} from '@/services/audio/playerAudioContracts';

describe('playerAudioContracts', () => {
	it('normalizes unified content id aliases', () => {
		expect(normalizeUnifiedContentId({ unified_content_id: 'uc-1' })).toBe(
			'uc-1'
		);
		expect(normalizeUnifiedContentId({ unifiedContentId: 'uc-2' })).toBe(
			'uc-2'
		);
		expect(normalizeUnifiedContentId({ content_id: 'uc-3' })).toBe('uc-3');
		expect(normalizeUnifiedContentId({ contentId: 'uc-4' })).toBe('uc-4');
		expect(normalizeUnifiedContentId({})).toBeNull();
	});

	it('reads unified content availability tombstones', () => {
		expect(
			unifiedContentAvailability({ unified_content_availability: 'missing' })
		).toBe('missing');
		expect(
			unifiedContentAvailability({ unified_content_availability: 'available' })
		).toBe('available');
		expect(isUnifiedContentReferenceMissing({})).toBe(false);
		expect(
			isUnifiedContentReferenceMissing({
				unified_content_availability: 'missing',
			})
		).toBe(true);
	});

	it('builds inline download URL with version key', () => {
		expect(
			buildContentDownloadUrlWithDisposition('abc 123', {
				disposition: 'inline',
				version: 'v7',
			})
		).toBe('/api/v1/content/abc%20123/download?disposition=inline&v=v7');
	});

	it('builds player asset cache key from version', () => {
		const asset = buildPlayerAudioAsset({
			unifiedContentId: 'uc-cache',
			title: 'Track',
			version: 'v2',
			thumbnailUrl: null,
			mimeType: 'audio/mpeg',
			sourceSurface: 'music-player',
		});
		expect(asset.cacheKey).toBe('uc-cache:v2');
		expect(asset.previewOnly).toBe(false);
		expect(asset.downloadUrl).toContain('disposition=inline');
	});
});
