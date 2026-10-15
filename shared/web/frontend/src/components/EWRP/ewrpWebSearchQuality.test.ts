import { describe, expect, it } from 'vitest';
import { ewrpWebSearchApiFields } from './ewrpWebSearchQuality';

describe('ewrpWebSearchApiFields', () => {
	it('maps deep tier to API payload', () => {
		expect(ewrpWebSearchApiFields('deep')).toEqual({
			web_search_quality: 'deep',
			use_web_search: true,
		});
	});
});
