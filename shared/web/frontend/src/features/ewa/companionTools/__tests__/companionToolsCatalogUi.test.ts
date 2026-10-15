/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for companion tools catalog helpers (U1.8).
 */

import { describe, expect, it } from 'vitest';

import { COMPANION_BUILTIN_EWA_TOOL_SPECS } from '@/features/ewa/companionTools/companionEwaToolsRegistry';
import {
	buildCompanionToolCatalogEntries,
	filterCompanionToolCatalogEntries,
} from '@/features/ewa/companionTools/companionToolsCatalogUi';
import { buildBuiltinCompanionQuickPresets } from '@/features/ewa/ewaCompanionQuickPresetsUi';

const t = ((key: string) => key) as never;

describe('companionToolsCatalogUi', () => {
	it('builds full EWA tool catalog (built-ins + EWA-only)', () => {
		const builtins = buildBuiltinCompanionQuickPresets(t);
		const entries = buildCompanionToolCatalogEntries(builtins, t, {
			embeddedMobile: false,
		});
		expect(entries.length).toBe(COMPANION_BUILTIN_EWA_TOOL_SPECS.length);
		expect(entries.some((row) => row.catalogId === 'doc_insert')).toBe(true);
		expect(entries.some((row) => row.catalogId === 'imageTool')).toBe(true);
		expect(entries.some((row) => row.catalogId === 'musicGenerate')).toBe(true);
		expect(
			entries.find((row) => row.catalogId === 'musicGenerate')?.ewaToolNames
		).toContain('music_generation');
	});

	it('filters by tool name and access channel', () => {
		const builtins = buildBuiltinCompanionQuickPresets(t);
		const entries = buildCompanionToolCatalogEntries(builtins, t, {
			embeddedMobile: false,
		});
		const filtered = filterCompanionToolCatalogEntries(
			entries,
			'music_generation'
		);
		expect(filtered.some((row) => row.catalogId === 'musicGenerate')).toBe(
			true
		);
	});
});
