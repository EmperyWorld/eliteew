/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing catalog of EWA companion instruments: built-ins + EWA-only tools, categories, access channels.
 *
 * Invariants:
 * - Pure data; ids align with ``companionEwaToolsRegistry`` and ``quick_intents`` canon.
 * - Desktop-only tools flagged explicitly for mobile UX honesty.
 *
 * Related:
 * - documentation/product/ewa/EWA-COMPANION-USER-UX-MAP.md
 * - src/features/ewa/companionTools/companionEwaToolsRegistry.ts
 */

import {
	COMPANION_BUILTIN_EWA_TOOL_SPECS,
	type CompanionEwaToolSpec,
	type CompanionToolAccessChannel,
	companionBuiltinChipId,
} from '@/features/ewa/companionTools/companionEwaToolsRegistry';
import type { BuiltinQuickPresetKey } from '@/features/ewa/ewaCompanionQuickPresetsUi';
import type { CompanionQuickPresetChip } from '@/features/ewa/ewaCompanionQuickPresetsUi';
import { EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX } from '@/services/ewa/ewaCompanionProfileApi';
import type { TFunction } from 'i18next';

export type CompanionToolCategoryId =
	| 'files'
	| 'music'
	| 'images'
	| 'desk'
	| 'plan'
	| 'theme'
	| 'memory';

export type CompanionToolAvailability =
	| 'available'
	| 'needs_editor'
	| 'desktop_only';

const CATEGORY_ORDER: CompanionToolCategoryId[] = [
	'files',
	'music',
	'images',
	'desk',
	'plan',
	'memory',
	'theme',
];

export type CompanionToolCatalogEntry = {
	/** Catalog row id (builtin key or ewa-only id). */
	catalogId: string;
	chip: CompanionQuickPresetChip;
	category: CompanionToolCategoryId;
	builtinKey: BuiltinQuickPresetKey | null;
	ewaToolNames: readonly string[];
	access: readonly CompanionToolAccessChannel[];
	availability: CompanionToolAvailability;
	description: string;
	examplePhrase: string;
	pinnable: boolean;
};

function readEwaToolCopy(
	t: TFunction<'marketing', undefined>,
	spec: CompanionEwaToolSpec,
	fallbackChip?: CompanionQuickPresetChip
): { label: string; description: string; examplePhrase: string } {
	const descriptions = t(
		`ewaCompanion.toolsCatalog.descriptions.${spec.i18nKey}`
	);
	const ewaLabel = t(
		`ewaCompanion.toolsCatalog.ewaTools.${spec.i18nKey}.label`
	);
	const ewaDescription = t(
		`ewaCompanion.toolsCatalog.ewaTools.${spec.i18nKey}.description`
	);
	const ewaExample = t(
		`ewaCompanion.toolsCatalog.ewaTools.${spec.i18nKey}.example`
	);
	const labelFromEwa = ewaLabel.startsWith(
		'ewaCompanion.toolsCatalog.ewaTools.'
	)
		? ''
		: ewaLabel.trim();
	const descriptionFromEwa = ewaDescription.startsWith(
		'ewaCompanion.toolsCatalog.ewaTools.'
	)
		? ''
		: ewaDescription.trim();
	const exampleFromEwa = ewaExample.startsWith(
		'ewaCompanion.toolsCatalog.ewaTools.'
	)
		? ''
		: ewaExample.trim();
	const descriptionFromBuiltin = descriptions.startsWith(
		'ewaCompanion.toolsCatalog.descriptions.'
	)
		? ''
		: descriptions.trim();
	return {
		label: fallbackChip?.label.trim() || labelFromEwa || spec.id,
		description:
			descriptionFromEwa || descriptionFromBuiltin || labelFromEwa || spec.id,
		examplePhrase:
			fallbackChip?.promptText.trim() ||
			exampleFromEwa ||
			labelFromEwa ||
			descriptionFromEwa ||
			spec.id,
	};
}

function availabilityFromSpec(
	spec: CompanionEwaToolSpec,
	_embeddedMobile: boolean
): CompanionToolAvailability {
	if (spec.desktopOnly) return 'desktop_only';
	if (spec.needsEditor) return 'needs_editor';
	return 'available';
}

function chipFromSpec(
	spec: CompanionEwaToolSpec,
	copy: { label: string; examplePhrase: string }
): CompanionQuickPresetChip {
	if (spec.builtinKey) {
		return {
			id: companionBuiltinChipId(spec.builtinKey),
			label: copy.label,
			promptText: copy.examplePhrase,
			builtin: true,
			sortOrder: spec.sortOrder,
		};
	}
	return {
		id: `${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}ewa.${spec.id}`,
		label: copy.label,
		promptText: copy.examplePhrase,
		builtin: true,
		sortOrder: spec.sortOrder,
	};
}

function builtinKeyFromChip(
	chip: CompanionQuickPresetChip
): BuiltinQuickPresetKey | null {
	if (!chip.id.startsWith(EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX))
		return null;
	const key = chip.id.slice(EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX.length);
	if (key.startsWith('ewa.')) return null;
	const spec = COMPANION_BUILTIN_EWA_TOOL_SPECS.find(
		(row) => row.builtinKey === key
	);
	return spec?.builtinKey ?? null;
}

export function companionToolAvailability(
	key: BuiltinQuickPresetKey,
	embeddedMobile: boolean
): CompanionToolAvailability {
	const spec = COMPANION_BUILTIN_EWA_TOOL_SPECS.find(
		(row) => row.builtinKey === key
	);
	if (!spec) return 'available';
	return availabilityFromSpec(spec, embeddedMobile);
}

export function buildCompanionToolCatalogEntries(
	builtinChips: CompanionQuickPresetChip[],
	t: TFunction<'marketing', undefined>,
	opts: { embeddedMobile: boolean }
): CompanionToolCatalogEntry[] {
	const chipByBuiltinKey = new Map<
		BuiltinQuickPresetKey,
		CompanionQuickPresetChip
	>();
	for (const chip of builtinChips) {
		const key = builtinKeyFromChip(chip);
		if (key) chipByBuiltinKey.set(key, chip);
	}

	const out: CompanionToolCatalogEntry[] = [];
	for (const spec of COMPANION_BUILTIN_EWA_TOOL_SPECS) {
		const fallbackChip = spec.builtinKey
			? chipByBuiltinKey.get(spec.builtinKey)
			: undefined;
		if (spec.builtinKey && !fallbackChip) continue;
		const copy = readEwaToolCopy(t, spec, fallbackChip);
		if (!copy.examplePhrase.trim()) continue;
		out.push({
			catalogId: spec.id,
			chip: chipFromSpec(spec, copy),
			category: spec.category,
			builtinKey: spec.builtinKey ?? null,
			ewaToolNames: spec.ewaToolNames,
			access: spec.access,
			availability: availabilityFromSpec(spec, opts.embeddedMobile),
			description: copy.description,
			examplePhrase: copy.examplePhrase,
			pinnable: Boolean(spec.builtinKey),
		});
	}
	return out.sort(
		(a, b) =>
			CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
			a.chip.sortOrder - b.chip.sortOrder
	);
}

export function filterCompanionToolCatalogEntries(
	entries: CompanionToolCatalogEntry[],
	query: string
): CompanionToolCatalogEntry[] {
	const q = query.trim().toLowerCase();
	if (!q) return entries;
	return entries.filter(
		(row) =>
			row.chip.label.toLowerCase().includes(q) ||
			row.description.toLowerCase().includes(q) ||
			row.examplePhrase.toLowerCase().includes(q) ||
			row.ewaToolNames.some((name) => name.toLowerCase().includes(q)) ||
			row.access.some((channel) => channel.toLowerCase().includes(q))
	);
}

export function groupCompanionToolCatalogByCategory(
	entries: CompanionToolCatalogEntry[]
): Map<CompanionToolCategoryId, CompanionToolCatalogEntry[]> {
	const map = new Map<CompanionToolCategoryId, CompanionToolCatalogEntry[]>();
	for (const cat of CATEGORY_ORDER) {
		map.set(cat, []);
	}
	for (const row of entries) {
		map.get(row.category)?.push(row);
	}
	return map;
}

export function companionToolCatalogEntryByChipId(
	entries: CompanionToolCatalogEntry[],
	chipId: string
): CompanionToolCatalogEntry | undefined {
	return entries.find((row) => row.chip.id === chipId);
}

export const COMPANION_TOOL_CATEGORY_ORDER = CATEGORY_ORDER;

export type { CompanionToolAccessChannel };
