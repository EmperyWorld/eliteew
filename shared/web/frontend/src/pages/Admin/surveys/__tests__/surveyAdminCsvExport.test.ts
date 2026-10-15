/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import {
	buildSurveyResponsesCsv,
	escapeCsvCell,
} from '../surveyAdminCsvExport';

describe('surveyAdminCsvExport', () => {
	it('escapes commas and quotes', () => {
		expect(escapeCsvCell('plain')).toBe('plain');
		expect(escapeCsvCell('a,b')).toBe('"a,b"');
		expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
	});

	it('builds csv with question columns', () => {
		const csv = buildSurveyResponsesCsv(
			[
				{
					id: 'q1',
					question_key: 'q1',
					question_type: 'text_short',
					prompt: 'Name',
					required: true,
					sort_order: 0,
					options_json: {},
					validation_json: {},
				},
			],
			[
				{
					submitted_at: '2026-07-03T00:00:00Z',
					user_id: 'user-1',
					answers_json: { q1: 'hello, world' },
				},
			]
		);
		expect(csv).toContain('submitted_at,user_id,username,email,q1');
		expect(csv).toContain('"hello, world"');
	});
});
