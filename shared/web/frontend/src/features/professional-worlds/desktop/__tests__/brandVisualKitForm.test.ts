/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import { validateProfessionalBrandKitDraft } from '../brandVisualKitForm';

describe('validateProfessionalBrandKitDraft', () => {
	it('rejects malformed primary colour', () => {
		const r = validateProfessionalBrandKitDraft({
			primary_hex: '#gg0000',
			accent_hex: '',
		});
		expect(r.ok).toBe(false);
		expect(r.messages[0]).toBe('brandKit.invalidPrimary');
	});
	it('allows empty optional colours', () => {
		expect(
			validateProfessionalBrandKitDraft({ primary_hex: '', accent_hex: '' }).ok
		).toBe(true);
	});
});
