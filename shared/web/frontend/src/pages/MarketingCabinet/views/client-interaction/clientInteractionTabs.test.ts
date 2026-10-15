import { describe, expect, it } from 'vitest';

import {
	getVisibleMarketingClientInteractionTabs,
	normalizeMarketingClientInteractionTab,
} from './clientInteractionTabs';

describe('getVisibleMarketingClientInteractionTabs', () => {
	it('returns empty list for embedded variant', () => {
		expect(
			getVisibleMarketingClientInteractionTabs({
				variant: 'embedded',
				layout: 'full',
				isLead: true,
			})
		).toEqual([]);
	});

	it('returns empty list when layout is not full', () => {
		expect(
			getVisibleMarketingClientInteractionTabs({
				variant: 'default',
				layout: 'documents-only',
				isLead: true,
			})
		).toEqual([]);
	});

	it('includes summary and diagnostic for lead in full default view', () => {
		expect(
			getVisibleMarketingClientInteractionTabs({
				variant: 'default',
				layout: 'full',
				isLead: true,
			})
		).toEqual(['summary', 'diagnostic', 'documents', 'presentations', 'chat']);
	});

	it('includes summary read-only for non-lead, omits diagnostic', () => {
		expect(
			getVisibleMarketingClientInteractionTabs({
				variant: 'default',
				layout: 'full',
				isLead: false,
			})
		).toEqual(['summary', 'documents', 'presentations', 'chat']);
	});
});

describe('normalizeMarketingClientInteractionTab', () => {
	it('keeps current tab when visible', () => {
		const visible = ['documents', 'presentations', 'chat'] as const;
		expect(normalizeMarketingClientInteractionTab([...visible], 'chat')).toBe(
			'chat'
		);
	});

	it('falls back to first visible tab when current is invalid', () => {
		const visible = ['summary', 'documents', 'presentations', 'chat'] as const;
		expect(
			normalizeMarketingClientInteractionTab([...visible], 'diagnostic')
		).toBe('summary');
	});
});
