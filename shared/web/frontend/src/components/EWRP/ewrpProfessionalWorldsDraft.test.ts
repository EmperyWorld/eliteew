/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
	consumeEwrpProfessionalWorldsDraft,
	parseEwrpProfessionalWorldsDraftCapsule,
} from './ewrpProfessionalWorldsDraft';

describe('parseEwrpProfessionalWorldsDraftCapsule', () => {
	it('maps PW adapter capsule to form fields', () => {
		const out = parseEwrpProfessionalWorldsDraftCapsule({
			destination: 'ewrp',
			property: { title_hint: 'Marine view', city: 'Vladivostok' },
			presentation: {
				title: 'Marine view',
				outline_markdown: '# Deck\nBody line',
			},
			media_unified_content_ids: ['uc-1', 'uc-2'],
		});
		expect(out).not.toBeNull();
		expect(out?.topic).toBe('Marine view');
		expect(out?.title).toBe('Marine view');
		expect(out?.extraContext).toContain('# Deck');
		expect(out?.extraContext).toContain('Vladivostok');
		expect(out?.sourceUnifiedContentId).toBe('uc-1');
	});

	it('returns null for non-ewrp destination', () => {
		expect(
			parseEwrpProfessionalWorldsDraftCapsule({ destination: 'gaf_chat' })
		).toBeNull();
	});
});

describe('consumeEwrpProfessionalWorldsDraft', () => {
	it('reads and clears sessionStorage once', () => {
		const key = 'eliteew.professionalWorlds.crossAppDraft.v1.ewrp.test';
		sessionStorage.setItem(
			key,
			JSON.stringify({
				destination: 'ewrp',
				property: { title_hint: 'Flat' },
				presentation: { title: 'Flat', outline_markdown: 'Points' },
			})
		);
		const first = consumeEwrpProfessionalWorldsDraft(key);
		expect(first?.topic).toBe('Flat');
		expect(sessionStorage.getItem(key)).toBeNull();
		expect(consumeEwrpProfessionalWorldsDraft(key)).toBeNull();
	});
});
