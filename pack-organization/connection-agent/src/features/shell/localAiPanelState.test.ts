/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock O3c local AI panel send gate + banner honesty.
 *
 * Related:
 * - localAiPanelState.ts
 */

import { describe, expect, it } from 'vitest';
import { canSendLocalAi, localAiBanner } from './localAiPanelState';

describe('canSendLocalAi', () => {
	it('requires base, model, prompt and idle', () => {
		expect(
			canSendLocalAi({
				baseConfigured: true,
				busy: false,
				prompt: 'hi',
				model: 'llama',
			})
		).toBe(true);
		expect(
			canSendLocalAi({
				baseConfigured: false,
				busy: false,
				prompt: 'hi',
				model: 'llama',
			})
		).toBe(false);
		expect(
			canSendLocalAi({
				baseConfigured: true,
				busy: true,
				prompt: 'hi',
				model: 'llama',
			})
		).toBe(false);
		expect(
			canSendLocalAi({
				baseConfigured: true,
				busy: false,
				prompt: '  ',
				model: 'llama',
			})
		).toBe(false);
		expect(
			canSendLocalAi({
				baseConfigured: true,
				busy: false,
				prompt: 'hi',
				model: '',
			})
		).toBe(false);
	});
});

describe('localAiBanner', () => {
	it('keeps ready message', () => {
		expect(localAiBanner('ready', 'Локальный AI · m')).toContain('Локальный');
	});
	it('falls back for not_configured', () => {
		expect(localAiBanner('not_configured', '')).toMatch(/не настроен/i);
	});
});
