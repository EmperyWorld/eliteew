/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest boundary coverage for Professional Worlds cross-app draft consumers used by downstream Desktop apps.
 *
 * Invariants:
 * - Draft keys are consumed once from sessionStorage.
 * - Consumer helpers build local seed values only; no network/send/publish side effects.
 *
 * Related:
 * - professionalWorldsCrossAppDraft.ts
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	consumeProfessionalWorldsCrossAppDraft,
	professionalWorldsDraftToEwDesk,
	professionalWorldsDraftToGaf,
	professionalWorldsDraftToSiteStudio,
} from './professionalWorldsCrossAppDraft';

describe('professionalWorldsCrossAppDraft', () => {
	afterEach(() => {
		sessionStorage.clear();
	});

	it('consumes and normalizes a draft capsule once', () => {
		const key = 'eliteew.professionalWorlds.crossAppDraft.v1.gaf.1';
		sessionStorage.setItem(
			key,
			JSON.stringify({
				destination: 'gaf_chat',
				property: { title_hint: '  Skyline Loft  ', city: '  Dubai  ' },
				message_body_draft: '  Hello realtor lead  ',
				attachment_unified_content_ids: ['  uc-1  ', ''],
			})
		);

		const capsule = consumeProfessionalWorldsCrossAppDraft(key);

		expect(capsule).toMatchObject({
			destination: 'gaf_chat',
			property: { title_hint: 'Skyline Loft', city: 'Dubai' },
			message_body_draft: 'Hello realtor lead',
			attachment_unified_content_ids: ['uc-1'],
		});
		expect(sessionStorage.getItem(key)).toBeNull();
		expect(consumeProfessionalWorldsCrossAppDraft(key)).toBeNull();
	});

	it('builds a GAF composer seed with optional unified content attachment', () => {
		const draft = professionalWorldsDraftToGaf({
			destination: 'gaf_chat',
			property: { title_hint: 'Skyline Loft' },
			message_body_draft: 'Client-ready message',
			attachment_unified_content_ids: ['uc-1'],
		});

		expect(draft).toEqual({
			seed: 'Client-ready message',
			attachment: {
				contentId: 'uc-1',
				fileName: 'Skyline Loft.md',
				size: null,
				mimeType: 'text/markdown',
			},
		});
	});

	it('maps a Site Studio draft into setup form values', () => {
		const draft = professionalWorldsDraftToSiteStudio({
			destination: 'site_studio',
			property: { title_hint: 'Family Villa', city: 'Lisbon' },
			presentation: { outline_markdown: '## Hero\nOcean view' },
			page_sections: [{ key: 'hero', title: 'Main offer' }],
		});

		expect(draft?.siteTitle).toBe('Family Villa');
		expect(draft?.siteTopic).toBe('Лендинг объекта: Family Villa');
		expect(draft?.brief).toContain('Город: Lisbon');
		expect(draft?.brief).toContain('## Hero');
		expect(draft?.brief).toContain('"key": "hero"');
	});

	it('maps EWDesk suggestions without publishing them', () => {
		const draft = professionalWorldsDraftToEwDesk({
			destination: 'ewdesk',
			property: { title_hint: 'Urban Flat' },
			suggestion_markdown: 'Draft announcement',
			cross_app_link_id: 'link-ewdesk',
		} as never);

		expect(draft).toEqual({
			title: 'Urban Flat',
			markdown: 'Draft announcement',
			crossAppLinkId: 'link-ewdesk',
		});
	});
});
