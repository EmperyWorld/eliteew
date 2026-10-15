/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock O3d third-party send gate (key required).
 */

import { describe, expect, it } from 'vitest';
import {
	canSendThirdPartyAi,
	thirdPartyAiBanner,
} from './thirdPartyAiPanelState';

describe('canSendThirdPartyAi', () => {
	it('requires key plus base/model/prompt', () => {
		expect(
			canSendThirdPartyAi({
				baseConfigured: true,
				hasApiKey: true,
				busy: false,
				prompt: 'hi',
				model: 'gpt',
			})
		).toBe(true);
		expect(
			canSendThirdPartyAi({
				baseConfigured: true,
				hasApiKey: false,
				busy: false,
				prompt: 'hi',
				model: 'gpt',
			})
		).toBe(false);
	});
});

describe('thirdPartyAiBanner', () => {
	it('mentions key source when present', () => {
		expect(thirdPartyAiBanner('ready', 'ok', 'keyring')).toContain('keyring');
	});
});
