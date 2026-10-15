/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral locks for chronicle chapter/domain keyboard cycle helpers.
 *
 * Invariants:
 * - Cycle wraps; null domain starts at spa (forward) or ops (backward).
 *
 * Related:
 * - data/chronicleChapters.ts
 */

import { describe, expect, it } from 'vitest';
import {
	CHRONICLE_CHAPTERS,
	CHRONICLE_DOMAIN_ORDER,
	chapterById,
	cycleChronicleChapter,
	cycleChronicleDomain,
} from '../data/chronicleChapters';

describe('chronicleChapters', () => {
	it('cycles domains with wrap and null entry', () => {
		expect(CHRONICLE_DOMAIN_ORDER[0]).toBe('spa');
		expect(cycleChronicleDomain(null, 1)).toBe('spa');
		expect(cycleChronicleDomain(null, -1)).toBe('ops');
		expect(cycleChronicleDomain('spa', 1)).toBe('api');
		expect(cycleChronicleDomain('ops', 1)).toBe('spa');
		expect(cycleChronicleDomain('spa', -1)).toBe('ops');
	});

	it('cycles chapters and maps default layers', () => {
		expect(CHRONICLE_CHAPTERS).toHaveLength(4);
		expect(cycleChronicleChapter('husk', 1)).toBe('word');
		expect(cycleChronicleChapter('sovereignty', 1)).toBe('husk');
		expect(cycleChronicleChapter('husk', -1)).toBe('sovereignty');
		expect(chapterById('sovereignty').layer).toBe('soul');
		expect(chapterById('word').layer).toBe('muscle');
	});
});
