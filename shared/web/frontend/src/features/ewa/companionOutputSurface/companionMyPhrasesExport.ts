/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build and download «Мои фразы» export JSON (U2.8) — user presets + local icon overrides.
 *
 * Invariants:
 * - Built-in quick chips are excluded; only user-owned presets export.
 * - Icon overrides are embedded per phrase when present in localStorage map.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionMyPhrasesMode.tsx
 */

import type { MyPhraseIconOverride } from '@/features/ewa/companionOutputSurface/companionMyPhraseIconsStorage';
import { isCompanionQuickPresetDeletable } from '@/features/ewa/ewaCompanionQuickPresetsUi';
import type { CompanionQuickPresetChip } from '@/features/ewa/ewaCompanionQuickPresetsUi';

export const COMPANION_MY_PHRASES_EXPORT_FORMAT =
	'eliteew.companion.my_phrases' as const;

export const COMPANION_MY_PHRASES_EXPORT_VERSION = 1 as const;

export type CompanionMyPhrasesExportPhrase = {
	label: string;
	prompt_text: string;
	sort_order: number;
	icon?: MyPhraseIconOverride;
};

export type CompanionMyPhrasesExportFile = {
	format: typeof COMPANION_MY_PHRASES_EXPORT_FORMAT;
	version: typeof COMPANION_MY_PHRASES_EXPORT_VERSION;
	exported_at: string;
	phrases: CompanionMyPhrasesExportPhrase[];
};

export function companionMyPhrasesExportFilename(exportedAt: Date): string {
	const stamp = exportedAt.toISOString().slice(0, 10);
	return `ewa-my-phrases-${stamp}.json`;
}

export function buildCompanionMyPhrasesExportPayload(
	presets: readonly CompanionQuickPresetChip[],
	phraseIconOverrides: ReadonlyMap<string, MyPhraseIconOverride>,
	exportedAt: Date = new Date()
): CompanionMyPhrasesExportFile {
	const phrases = presets
		.filter((row) => isCompanionQuickPresetDeletable(row))
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((row) => {
			const icon = phraseIconOverrides.get(row.id);
			const entry: CompanionMyPhrasesExportPhrase = {
				label: row.label.trim(),
				prompt_text: row.promptText.trim(),
				sort_order: row.sortOrder,
			};
			if (icon) {
				entry.icon = icon;
			}
			return entry;
		});

	return {
		format: COMPANION_MY_PHRASES_EXPORT_FORMAT,
		version: COMPANION_MY_PHRASES_EXPORT_VERSION,
		exported_at: exportedAt.toISOString(),
		phrases,
	};
}

export function stringifyCompanionMyPhrasesExport(
	payload: CompanionMyPhrasesExportFile
): string {
	return `${JSON.stringify(payload, null, 2)}\n`;
}

export function triggerCompanionMyPhrasesExportDownload(
	payload: CompanionMyPhrasesExportFile
): void {
	if (typeof document === 'undefined') {
		throw new Error('companion_my_phrases_export_unavailable');
	}
	const blob = new Blob([stringifyCompanionMyPhrasesExport(payload)], {
		type: 'application/json;charset=utf-8',
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = companionMyPhrasesExportFilename(
		new Date(payload.exported_at)
	);
	anchor.rel = 'noopener';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}
