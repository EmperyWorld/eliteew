/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for Markdown URL guards used by LLM/user-content renderers.
 *
 * Invariants:
 * - Unsafe and protocol-relative URLs remain inert text.
 * - Trusted image hosts stay explicitly allowlisted.
 *
 * Related:
 * - src/utils/markdownSecurity.ts
 */
import { describe, expect, it } from 'vitest';
import {
	isTrustedMarkdownImageSrc,
	sanitizeMarkdownHref,
} from '../markdownSecurity';

describe('sanitizeMarkdownHref', () => {
	it('allows absolute http and https links', () => {
		expect(sanitizeMarkdownHref('https://eliteew.ru/a')).toBe(
			'https://eliteew.ru/a'
		);
		expect(sanitizeMarkdownHref('http://example.com')).toBe(
			'http://example.com'
		);
	});

	it('blocks active, relative, and protocol-relative links', () => {
		expect(sanitizeMarkdownHref('javascript:alert(1)')).toBeUndefined();
		expect(sanitizeMarkdownHref('data:text/html,<svg>')).toBeUndefined();
		expect(sanitizeMarkdownHref('//evil.example/path')).toBeUndefined();
		expect(sanitizeMarkdownHref('/internal/path')).toBeUndefined();
	});
});

describe('isTrustedMarkdownImageSrc', () => {
	it('allows same-origin and product media hosts', () => {
		expect(isTrustedMarkdownImageSrc('/api/v1/content/x/download')).toBe(true);
		expect(isTrustedMarkdownImageSrc('https://cdn.eliteew.ru/a.png')).toBe(
			true
		);
		expect(
			isTrustedMarkdownImageSrc('https://bucket.r2.cloudflarestorage.com/a.png')
		).toBe(true);
	});

	it('blocks arbitrary hosts and active schemes', () => {
		expect(isTrustedMarkdownImageSrc('https://tracker.example/pixel')).toBe(
			false
		);
		expect(isTrustedMarkdownImageSrc('//tracker.example/pixel')).toBe(false);
		expect(isTrustedMarkdownImageSrc('data:image/svg+xml,<svg>')).toBe(false);
	});
});
