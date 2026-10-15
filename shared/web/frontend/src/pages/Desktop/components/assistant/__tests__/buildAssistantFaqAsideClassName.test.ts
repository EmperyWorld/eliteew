/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for pure FAQ aside class-name builder.
 *
 * Invariants:
 * - Embedded mobile layout drops md sidebar width tokens.
 *
 * Related:
 * - pages/Desktop/components/assistant/buildAssistantFaqAsideClassName.ts
 */
import { describe, expect, it } from 'vitest';
import { buildAssistantFaqAsideClassName } from '../buildAssistantFaqAsideClassName';

describe('buildAssistantFaqAsideClassName', () => {
	it('uses full-width mobile embedded layout without md sidebar width', () => {
		const className = buildAssistantFaqAsideClassName({
			shellFrame: 'glass',
			embeddedMobileLayout: true,
			faqSearch: '',
			faqSearchFocused: false,
		});
		expect(className).toContain('w-full');
		expect(className).toContain('max-h-[min(42dvh,20rem)]');
		expect(className).toContain('mobile-handbook-faq-open');
		expect(className).not.toContain('md:w-[min(100%,14rem)]');
	});

	it('adds search-active aside accent when FAQ search has text', () => {
		const className = buildAssistantFaqAsideClassName({
			shellFrame: 'glass',
			embeddedMobileLayout: false,
			faqSearch: 'billing',
			faqSearchFocused: false,
		});
		expect(className).toContain('md:border-r-[2px]');
	});

	it('adds search-active aside accent when FAQ search field is focused', () => {
		const className = buildAssistantFaqAsideClassName({
			shellFrame: 'glass',
			embeddedMobileLayout: false,
			faqSearch: '',
			faqSearchFocused: true,
		});
		expect(className).toContain('md:border-r-[2px]');
	});

	it('uses softer desktop rail padding and panel mix', () => {
		const className = buildAssistantFaqAsideClassName({
			shellFrame: 'glass',
			embeddedMobileLayout: false,
			faqSearch: '',
			faqSearchFocused: false,
		});
		expect(className).toContain('p-2.5');
		expect(className).toContain(
			'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_58%,transparent)]'
		);
	});
});
