/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit lock for GAF Chat upload progress quantization (5% UI steps).
 *
 * Related:
 * - gafChatUploadProgress.ts
 */

import { describe, expect, it } from 'vitest';
import {
	batchUploadProgressPercent,
	nextSteppedUploadProgress,
	quantizeUploadProgressPercent,
} from '../gafChatUploadProgress';

describe('gafChatUploadProgress', () => {
	it('quantizes to 5% floors and snaps 100', () => {
		expect(quantizeUploadProgressPercent(0)).toBe(0);
		expect(quantizeUploadProgressPercent(4)).toBe(0);
		expect(quantizeUploadProgressPercent(5)).toBe(5);
		expect(quantizeUploadProgressPercent(14)).toBe(10);
		expect(quantizeUploadProgressPercent(99)).toBe(95);
		expect(quantizeUploadProgressPercent(100)).toBe(100);
	});

	it('never decreases within a session', () => {
		expect(nextSteppedUploadProgress(20, 12)).toBe(20);
		expect(nextSteppedUploadProgress(20, 27)).toBe(25);
		expect(nextSteppedUploadProgress(95, 100)).toBe(100);
	});

	it('combines sequential multi-file batch progress', () => {
		expect(batchUploadProgressPercent(0, 2, 50)).toBe(25);
		expect(batchUploadProgressPercent(1, 2, 0)).toBe(50);
		expect(batchUploadProgressPercent(1, 2, 100)).toBe(100);
		expect(batchUploadProgressPercent(0, 1, 73)).toBe(73);
	});
});
