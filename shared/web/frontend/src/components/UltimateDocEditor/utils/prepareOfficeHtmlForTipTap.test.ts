import { describe, expect, it } from 'vitest';
import { prepareOfficeHtmlForTipTap } from './prepareOfficeHtmlForTipTap';

describe('prepareOfficeHtmlForTipTap', () => {
	it('extracts body from Tika XHTML wrapper', () => {
		const input =
			'<html><head><style>.x{}</style></head><body><p>Line one</p><p>Line two</p></body></html>';
		const out = prepareOfficeHtmlForTipTap(input);
		expect(out).toContain('<p>Line one</p>');
		expect(out).not.toMatch(/<html/i);
		expect(out).not.toMatch(/<style/i);
	});

	it('restores legacy escaped br tags to real line breaks', () => {
		const input = '<p>sad &lt;br/&gt;a &lt;br/&gt;sd</p>';
		const out = prepareOfficeHtmlForTipTap(input);
		expect(out).toBe('<p>sad <br />a <br />sd</p>');
	});

	it('returns empty paragraph for blank input', () => {
		expect(prepareOfficeHtmlForTipTap('')).toBe('<p></p>');
		expect(prepareOfficeHtmlForTipTap('   ')).toBe('<p></p>');
	});
});
