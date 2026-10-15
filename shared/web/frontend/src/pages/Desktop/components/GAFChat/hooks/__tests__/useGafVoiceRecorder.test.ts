/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for GAF voice recorder elapsed-time helper.
 *
 * Related:
 * - components/GAFChat/hooks/useGafVoiceRecorder.ts
 */

import { describe, expect, it } from 'vitest';

import { computeGafVoiceRecorderElapsedSec } from '@/pages/Desktop/components/GAFChat/hooks/useGafVoiceRecorder';

describe('computeGafVoiceRecorderElapsedSec', () => {
	it('returns zero for invalid start time', () => {
		expect(computeGafVoiceRecorderElapsedSec(0, 10_000)).toBe(0);
	});

	it('floors elapsed seconds from monotonic clock', () => {
		const start = 1_000;
		expect(computeGafVoiceRecorderElapsedSec(start, start + 2500)).toBe(2);
		expect(computeGafVoiceRecorderElapsedSec(start, start + 2999)).toBe(2);
	});
});
