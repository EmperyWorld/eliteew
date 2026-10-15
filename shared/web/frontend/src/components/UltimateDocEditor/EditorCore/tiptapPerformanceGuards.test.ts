/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for cheap TipTap selection guards that avoid repeated full selection text extraction.
 *
 * Invariants:
 * - Same selection/document-size signatures are skipped.
 * - Same range with changed document size is treated as meaningful work.
 *
 * Related:
 * - src/components/UltimateDocEditor/EditorCore/tiptapPerformanceGuards.ts
 */
import { describe, expect, it } from 'vitest';
import {
	buildTiptapSelectionRangeSignature,
	shouldSkipTiptapSelectionWork,
} from './tiptapPerformanceGuards';

describe('tiptapPerformanceGuards', () => {
	it('builds stable signatures for unchanged selection ranges', () => {
		const first = buildTiptapSelectionRangeSignature({
			from: 4,
			to: 12,
			docContentSize: 200,
		});
		const second = buildTiptapSelectionRangeSignature({
			from: 4,
			to: 12,
			docContentSize: 200,
		});

		expect(shouldSkipTiptapSelectionWork(first, second)).toBe(true);
	});

	it('does not skip when document size changes under the same range', () => {
		const first = buildTiptapSelectionRangeSignature({
			from: 4,
			to: 12,
			docContentSize: 200,
		});
		const second = buildTiptapSelectionRangeSignature({
			from: 4,
			to: 12,
			docContentSize: 201,
		});

		expect(shouldSkipTiptapSelectionWork(first, second)).toBe(false);
	});
});
