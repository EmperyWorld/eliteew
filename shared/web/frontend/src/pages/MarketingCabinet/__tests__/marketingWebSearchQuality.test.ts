/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import {
	isMarketingWebSearchQuality,
	marketingWebSearchApiFields,
} from '../marketingWebSearchQuality';

describe('marketingWebSearchApiFields', () => {
	it('returns off-only payload when quality is off', () => {
		expect(marketingWebSearchApiFields('off')).toEqual({
			web_search_quality: 'off',
			use_web_search: false,
			max_tokens: 2500,
		});
	});

	it('maps non-off tiers to legacy use_web_search flag', () => {
		expect(marketingWebSearchApiFields('standard')).toEqual({
			web_search_quality: 'standard',
			use_web_search: true,
			max_tokens: 2500,
		});
	});
});

describe('isMarketingWebSearchQuality', () => {
	it('accepts known tier ids', () => {
		expect(isMarketingWebSearchQuality('deep')).toBe(true);
		expect(isMarketingWebSearchQuality('bogus')).toBe(false);
	});
});
