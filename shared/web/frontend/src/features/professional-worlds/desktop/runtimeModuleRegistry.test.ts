/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Registry lookup tests for realtor playbooks runtime module.
 */

import { describe, expect, it } from 'vitest';

import { getRuntimeModuleRegistryEntry } from './runtimeModuleRegistry';

describe('getRuntimeModuleRegistryEntry', () => {
	it('resolves realtor_playbooks', () => {
		const entry = getRuntimeModuleRegistryEntry('realtor_playbooks');
		expect(entry?.moduleKey).toBe('realtor_playbooks');
		expect(entry?.panelKind).toBe('dedicated');
	});

	it('resolves legacy hyphenated key', () => {
		expect(getRuntimeModuleRegistryEntry('realtor-playbooks')?.moduleKey).toBe(
			'realtor_playbooks'
		);
	});
});
