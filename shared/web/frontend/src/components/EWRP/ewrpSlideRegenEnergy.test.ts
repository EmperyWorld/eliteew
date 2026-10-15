import { describe, expect, it } from 'vitest';
import {
	EWRP_SLIDE_REGEN_IMAGE_ENERGY,
	EWRP_SLIDE_REGEN_TEXT_ENERGY,
} from './ewrpSlideRegenEnergy';

describe('ewrpSlideRegenEnergy', () => {
	it('fixes image regen UI energy to 50', () => {
		expect(EWRP_SLIDE_REGEN_IMAGE_ENERGY).toBe(50);
	});

	it('fixes text regen UI energy to 10', () => {
		expect(EWRP_SLIDE_REGEN_TEXT_ENERGY).toBe(10);
	});
});
