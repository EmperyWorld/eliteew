/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Social Hub People directory chrome: sentence-case metrics, quiet panel glow.
 *
 * Invariants:
 * - Directory metric row has no uppercase shout.
 * - Directory panel glow has no cyan/emerald/violet radial wash.
 * - Overview IA strip has no cyan radial wash.
 *
 * Related:
 * - ../socialHubLayoutTokens.ts
 * - ../../components/directory/FriendsDirectoryOverviewStrip.tsx
 * - documentation/product/SOCIAL-HUB.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	SH_DIRECTORY_METRIC_ROW_CLASS,
	SH_WORKSPACE_PANEL_CLASS,
	shDirectoryMetricChipClass,
	shDirectoryPanelGlowClass,
} from '../socialHubLayoutTokens';

const here = dirname(fileURLToPath(import.meta.url));

describe('socialHubPeopleChrome.premium.contract', () => {
	it('keeps workspace panel and directory glow without accent radial wash', () => {
		expect(SH_WORKSPACE_PANEL_CLASS).not.toMatch(/radial-gradient/);
		expect(shDirectoryPanelGlowClass('friends')).not.toMatch(/radial-gradient/);
		expect(shDirectoryPanelGlowClass('incoming')).not.toMatch(
			/radial-gradient/
		);
		expect(shDirectoryPanelGlowClass('sent')).not.toMatch(/radial-gradient/);
	});

	it('keeps directory metric chips sentence-case', () => {
		expect(SH_DIRECTORY_METRIC_ROW_CLASS).not.toMatch(/\buppercase\b/);
		expect(SH_DIRECTORY_METRIC_ROW_CLASS).toMatch(/tracking-normal/);
		expect(shDirectoryMetricChipClass('neutral')).toContain('rounded-md');
		expect(shDirectoryMetricChipClass('neutral')).not.toContain('rounded-full');
	});

	it('wires overview strip without cyan radial wash', () => {
		const strip = readFileSync(
			join(
				here,
				'../../../components/directory/FriendsDirectoryOverviewStrip.tsx'
			),
			'utf8'
		);
		expect(strip).not.toMatch(/radial-gradient/);
		expect(strip).not.toMatch(/cyan-400\/30|cyan-500\/10|text-cyan-100/);
	});
});
