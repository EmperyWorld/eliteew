/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for companion output surface coercion.
 *
 * Invariants:
 * - Surface mode allowlist mirrors backend ``output_surface.mode`` contracts.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/types.ts
 */

import { describe, expect, it } from 'vitest';

import { coerceCompanionOutputSurface } from '@/features/ewa/companionOutputSurface/types';

describe('companion output surface', () => {
	it('coerces server payload', () => {
		expect(
			coerceCompanionOutputSurface({
				mode: 'music_xl_base_wizard',
				payload: { default_style: 'pop' },
			})
		).toEqual({
			mode: 'music_xl_base_wizard',
			payload: { default_style: 'pop' },
		});
	});

	it('rejects unknown mode', () => {
		expect(coerceCompanionOutputSurface({ mode: 'unknown' })).toBeNull();
	});

	it('normalizes retired workflow_builder to workflow_dag_builder', () => {
		expect(
			coerceCompanionOutputSurface({ mode: 'workflow_builder', payload: {} })
		).toEqual({
			mode: 'workflow_dag_builder',
			payload: {},
		});
	});
});
