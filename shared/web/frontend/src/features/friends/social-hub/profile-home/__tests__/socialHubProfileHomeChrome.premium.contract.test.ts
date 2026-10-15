/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Social Hub Profile Home chrome: quiet pulse labels + privacy chips.
 *
 * Invariants:
 * - Pulse labels use SH_SECTION_EYEBROW_CLASS (no uppercase).
 * - Privacy chip row / variants stay sentence-case.
 *
 * Related:
 * - ../../layout/socialHubLayoutTokens.ts
 * - ../ProfileAccountPulse.tsx
 * - documentation/product/SOCIAL-HUB.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	SH_PRIVACY_CHIP_ROW_CLASS,
	SH_SECTION_EYEBROW_CLASS,
	shPrivacyChipClass,
} from '../../layout/socialHubLayoutTokens';

const here = dirname(fileURLToPath(import.meta.url));

describe('socialHubProfileHomeChrome.premium.contract', () => {
	it('keeps privacy chips and pulse eyebrows sentence-case', () => {
		expect(SH_SECTION_EYEBROW_CLASS).not.toMatch(/\buppercase\b/);
		expect(SH_PRIVACY_CHIP_ROW_CLASS).not.toMatch(/\buppercase\b/);
		expect(shPrivacyChipClass('success')).not.toMatch(/\buppercase\b/);
		expect(shPrivacyChipClass('warning')).not.toMatch(/\buppercase\b/);
		expect(shPrivacyChipClass('success')).toContain('rounded-md');
	});

	it('wires AccountPulse without uppercase shout labels', () => {
		const pulse = readFileSync(
			join(here, '../ProfileAccountPulse.tsx'),
			'utf8'
		);
		expect(pulse).toContain('SH_SECTION_EYEBROW_CLASS');
		expect(pulse).not.toMatch(
			/profileHomePulseStatsLabel[\s\S]{0,80}\buppercase\b/
		);
		expect(pulse).not.toMatch(
			/profileHomePulseActivityLabel[\s\S]{0,80}\buppercase\b/
		);
	});
});
