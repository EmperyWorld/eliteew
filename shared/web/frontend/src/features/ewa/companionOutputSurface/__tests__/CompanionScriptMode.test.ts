/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for script template variable substitution (U2.5).
 */

import { describe, expect, it } from 'vitest';

import {
	extractScriptVariables,
	renderScriptTemplate,
} from '@/features/ewa/companionOutputSurface/CompanionScriptMode';

describe('CompanionScriptMode helpers', () => {
	it('extracts variables from template', () => {
		expect(extractScriptVariables('Hello {topic} and {tone}')).toEqual([
			'topic',
			'tone',
		]);
	});

	it('renders template with values', () => {
		expect(
			renderScriptTemplate('Song about {topic}', { topic: 'summer' })
		).toBe('Song about summer');
	});
});
