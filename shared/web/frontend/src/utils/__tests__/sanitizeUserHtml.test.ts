/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for HTML sanitizers used before dangerouslySetInnerHTML.
 *
 * Invariants:
 * - Search highlight sanitizer strips script/event handlers while preserving mark tags.
 *
 * Related:
 * - `utils/sanitizeUserHtml.ts`
 */
import { describe, expect, it } from 'vitest';
import {
	sanitizeMermaidSvg,
	sanitizeSearchHighlightHtml,
	sanitizeUserHtml,
} from '../sanitizeUserHtml';

describe('sanitizeSearchHighlightHtml', () => {
	it('preserves safe mark emphasis from search API', () => {
		const input = 'hello <mark class="hl">world</mark>!';
		expect(sanitizeSearchHighlightHtml(input)).toBe(input);
	});

	it('strips script tags and event handlers from malicious highlights', () => {
		const malicious =
			'<img src=x onerror=alert(1)><script>alert(1)</script><mark>ok</mark>';
		expect(sanitizeSearchHighlightHtml(malicious)).toBe('<mark>ok</mark>');
	});

	it('strips javascript links while keeping inline emphasis', () => {
		const input = '<a href="javascript:alert(1)">x</a><strong>safe</strong>';
		expect(sanitizeSearchHighlightHtml(input)).toBe('x<strong>safe</strong>');
	});
});

describe('sanitizeUserHtml', () => {
	it('allows basic markdown tags', () => {
		expect(sanitizeUserHtml('<p><strong>hi</strong></p>')).toBe(
			'<p><strong>hi</strong></p>'
		);
	});
});

describe('sanitizeMermaidSvg', () => {
	it('preserves drawing primitives from Mermaid SVG output', () => {
		const input =
			'<svg viewBox="0 0 10 10" role="img"><g class="node"><path d="M0 0L10 10" marker-end="url(#arrow)"></path><text x="1" y="2">ok</text></g></svg>';
		expect(sanitizeMermaidSvg(input)).toContain('<svg');
		expect(sanitizeMermaidSvg(input)).toContain('<path');
		expect(sanitizeMermaidSvg(input)).toContain('marker-end="url(#arrow)"');
	});

	it('strips active SVG content before innerHTML insertion', () => {
		const malicious =
			'<svg onload="alert(1)"><script>alert(1)</script><a href="javascript:alert(2)"><text>bad</text></a><text onclick="alert(3)">safe</text></svg>';
		const clean = sanitizeMermaidSvg(malicious);
		expect(clean).not.toContain('script');
		expect(clean).not.toContain('onload');
		expect(clean).not.toContain('onclick');
		expect(clean).not.toContain('javascript:');
		expect(clean).toContain('<text>safe</text>');
	});
});
