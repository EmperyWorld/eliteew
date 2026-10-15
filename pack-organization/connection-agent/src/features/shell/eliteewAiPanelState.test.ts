/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock O3e EliteEW AI send gate (network required).
 */

import { describe, expect, it } from 'vitest';
import { canSendEliteewAi, eliteewAiBanner } from './eliteewAiPanelState';

describe('canSendEliteewAi', () => {
	it('requires network plus base/model/prompt', () => {
		expect(
			canSendEliteewAi({
				baseConfigured: true,
				networkOk: true,
				busy: false,
				prompt: 'hi',
				model: 'm',
			})
		).toBe(true);
		expect(
			canSendEliteewAi({
				baseConfigured: true,
				networkOk: false,
				busy: false,
				prompt: 'hi',
				model: 'm',
			})
		).toBe(false);
	});
});

describe('eliteewAiBanner', () => {
	it('surfaces offline honestly', () => {
		expect(eliteewAiBanner('offline', '', false)).toMatch(/сети/i);
	});
});
