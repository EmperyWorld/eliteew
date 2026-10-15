import { describe, expect, it } from 'vitest';
import {
	buildContentBlobCacheRevision,
	buildContentDownloadUrl,
} from './contentApi';

describe('buildContentBlobCacheRevision', () => {
	it('joins updated_at and file_size', () => {
		expect(
			buildContentBlobCacheRevision({
				updated_at: '2026-01-01T00:00:00Z',
				file_size: 42,
			})
		).toBe('2026-01-01T00:00:00Z|42');
	});

	it('uses 0 when file_size null', () => {
		expect(
			buildContentBlobCacheRevision({ updated_at: 't', file_size: null })
		).toBe('t|0');
	});
});

describe('buildContentDownloadUrl', () => {
	it('adds v query when revision set', () => {
		const u = buildContentDownloadUrl('abc-def-ghi', 'rev|1');
		expect(u).toContain('/api/v1/content/abc-def-ghi/download');
		expect(u).toContain('v=rev%7C1');
	});

	it('no query without revision', () => {
		expect(buildContentDownloadUrl('x')).toBe('/api/v1/content/x/download');
	});
});
