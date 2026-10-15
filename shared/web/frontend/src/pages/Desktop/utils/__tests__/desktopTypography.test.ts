/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for desktop typography stack resolution and CSS variable names.
 *
 * Invariants:
 * - Display "system" mirrors body stack.
 *
 * Related:
 * - desktopTypography.ts
 */

import { describe, expect, it } from 'vitest';
import {
	resolveDesktopFontDisplayStack,
	resolveDesktopFontFamilyStack,
} from '../desktopTypography';

describe('desktopTypography', () => {
	it('resolves body font stacks', () => {
		expect(resolveDesktopFontFamilyStack('manrope')).toContain('Manrope');
		expect(resolveDesktopFontFamilyStack('poppins')).toContain('Poppins');
	});

	it('display system follows body', () => {
		const body = resolveDesktopFontFamilyStack('raleway');
		expect(resolveDesktopFontDisplayStack('system', body)).toBe(body);
	});

	it('display accent uses its own stack', () => {
		expect(resolveDesktopFontDisplayStack('cinzel', 'manrope')).toContain(
			'Cinzel'
		);
	});
});
