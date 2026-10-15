/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest для filterKbDocuments / kbDocumentStatusOptions.
 *
 * Related:
 * - pages/Desktop/utils/assistantKbSearch.ts
 */
import { describe, expect, it } from 'vitest';
import {
	filterKbDocuments,
	kbDocumentShowUpdatedAt,
	kbDocumentStatusOptions,
	sortKbDocumentsByUpdatedDesc,
} from '../assistantKbSearch';

const docs = [
	{
		id: '1',
		title: 'kb-magazin.md',
		status: 'indexed',
		source_filename: 'kb-magazin.md',
		last_error: null,
	},
	{
		id: '2',
		title: 'Broken doc',
		status: 'error',
		source_filename: 'bad.pdf',
		last_error: 'embed timeout',
	},
];

describe('assistantKbSearch', () => {
	it('filters by title substring', () => {
		expect(filterKbDocuments(docs, 'magazin').map((d) => d.id)).toEqual(['1']);
	});

	it('filters by last_error', () => {
		expect(filterKbDocuments(docs, 'timeout').map((d) => d.id)).toEqual(['2']);
	});

	it('applies status filter', () => {
		expect(filterKbDocuments(docs, '', 'error').map((d) => d.id)).toEqual([
			'2',
		]);
	});

	it('collects unique statuses', () => {
		expect(kbDocumentStatusOptions(docs)).toEqual(['indexed', 'error']);
	});

	it('sorts by updated_at descending', () => {
		const sorted = sortKbDocumentsByUpdatedDesc([
			{ ...docs[0], updated_at: '2026-01-01T00:00:00Z' },
			{ ...docs[1], updated_at: '2026-06-01T00:00:00Z' },
		]);
		expect(sorted.map((d) => d.id)).toEqual(['2', '1']);
	});

	it('detects distinct updated_at', () => {
		expect(
			kbDocumentShowUpdatedAt({
				created_at: '2026-01-01T00:00:00Z',
				updated_at: '2026-01-01T00:00:00Z',
			})
		).toBe(false);
		expect(
			kbDocumentShowUpdatedAt({
				created_at: '2026-01-01T00:00:00Z',
				updated_at: '2026-06-01T00:00:00Z',
			})
		).toBe(true);
	});
});
