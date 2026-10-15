import { describe, expect, it } from 'vitest';
import { buildPoemmaUtmUrl } from '../poemmaUtm';

describe('buildPoemmaUtmUrl', () => {
	it('builds query params for a full URL', () => {
		const url = buildPoemmaUtmUrl({
			baseUrl: 'https://mysite.ru/landing',
			utmSource: 'vk',
			utmMedium: 'cpc',
			utmCampaign: 'leto2026',
		});
		expect(url).toBe(
			'https://mysite.ru/landing?utm_source=vk&utm_campaign=leto2026&utm_medium=cpc'
		);
	});

	it('adds https when scheme is missing', () => {
		const url = buildPoemmaUtmUrl({
			baseUrl: 'mysite.ru',
			utmSource: 'vk',
			utmCampaign: 'leto2026',
		});
		expect(url).toContain('https://mysite.ru');
		expect(url).toContain('utm_source=vk');
	});

	it('returns null when required fields are empty', () => {
		expect(
			buildPoemmaUtmUrl({
				baseUrl: 'https://mysite.ru',
				utmSource: '',
				utmCampaign: 'x',
			})
		).toBeNull();
	});
});
