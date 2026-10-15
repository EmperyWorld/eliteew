/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CSV field escaping used in client-side exports.
 */

import { describe, expect, it } from 'vitest';
import { escapeCsvCell, escapeCsvField } from '../csvEscapeField';

describe('csvEscapeField', () => {
	it('quotes fields with commas and embedded double quotes', () => {
		expect(escapeCsvField('plain')).toBe('plain');
		expect(escapeCsvField('a,b')).toBe('"a,b"');
		expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
		expect(escapeCsvField('line\nbreak')).toBe('"line\nbreak"');
	});

	it('normalizes nullish cells to empty string', () => {
		expect(escapeCsvCell(null)).toBe('');
		expect(escapeCsvCell(undefined)).toBe('');
		expect(escapeCsvCell(42)).toBe('42');
	});
});
