/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for HTTP Range header parsing/building used by music download helpers.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerAudioRange.ts
 */

import { describe, expect, it } from 'vitest';

import {
	buildBytesRangeHeader,
	buildSuffixBytesRangeHeader,
	mergeRangeChunks,
	parseContentRangeHeader,
	serverAcceptsByteRanges,
} from '../musicPlayerAudioRange';

describe('musicPlayerAudioRange', () => {
	it('parses canonical Content-Range headers', () => {
		expect(parseContentRangeHeader('bytes 0-15/4096')).toEqual({
			unit: 'bytes',
			start: 0,
			end: 15,
			total: 4096,
		});
		expect(parseContentRangeHeader('BYTES 100-200/500')).toEqual({
			unit: 'bytes',
			start: 100,
			end: 200,
			total: 500,
		});
	});

	it('rejects malformed Content-Range headers', () => {
		expect(parseContentRangeHeader('')).toBeNull();
		expect(parseContentRangeHeader('items 0-1/2')).toBeNull();
		expect(parseContentRangeHeader('bytes 10-5/20')).toBeNull();
	});

	it('builds Range request headers', () => {
		expect(buildBytesRangeHeader(0, 15)).toBe('bytes=0-15');
		expect(buildBytesRangeHeader(128)).toBe('bytes=128-');
		expect(buildSuffixBytesRangeHeader(512)).toBe('bytes=-512');
	});

	it('detects Accept-Ranges: bytes', () => {
		expect(serverAcceptsByteRanges('bytes')).toBe(true);
		expect(serverAcceptsByteRanges('none')).toBe(false);
		expect(serverAcceptsByteRanges(null)).toBe(false);
	});

	it('merges range chunks into one blob payload', () => {
		const blob = mergeRangeChunks([
			new Uint8Array([1, 2]),
			new Uint8Array([3, 4, 5]),
		]);
		expect(blob.size).toBe(5);
	});
});
