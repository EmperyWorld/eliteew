/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure parse/label helpers for MusicForge Pipeline Builder admin UI.
 *
 * Invariants:
 * - No React; modes/stages sorted by sort_order.
 *
 * Related:
 * - `pages/Admin/musicForge/MusicForgePipelineBuilder.tsx`
 */

import type {
	MusicForgeModeRow,
	MusicForgeStageRow,
} from './musicForgeAdminApi';

export function asRecord(value: unknown): Record<string, unknown> {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

export function parseModes(
	raw: Record<string, unknown> | undefined
): MusicForgeModeRow[] {
	const modes = Object.values(raw ?? {}).map((row) => {
		const r = asRecord(row);
		return {
			mode_key: String(r.mode_key ?? ''),
			label_ru: String(r.label_ru ?? ''),
			label_en: String(r.label_en ?? ''),
			description: r.description == null ? null : String(r.description),
			enabled: Boolean(r.enabled),
			is_default: Boolean(r.is_default),
			sort_order: Number(r.sort_order ?? 0),
			style_hint_default:
				r.style_hint_default == null ? null : String(r.style_hint_default),
			lane_key: String(r.lane_key ?? ''),
		} satisfies MusicForgeModeRow;
	});
	modes.sort((a, b) => a.sort_order - b.sort_order);
	return modes.filter((m) => m.mode_key);
}

export function parseStages(
	pipelines: Record<string, unknown> | undefined,
	modeKey: string
): MusicForgeStageRow[] {
	const raw = pipelines?.[modeKey];
	if (!Array.isArray(raw)) return [];
	const stages = raw.map((row) => {
		const r = asRecord(row);
		return {
			stage_key: String(r.stage_key ?? ''),
			stage_type: String(r.stage_type ?? ''),
			title_ru: String(r.title_ru ?? ''),
			sort_order: Number(r.sort_order ?? 0),
			enabled: Boolean(r.enabled),
			settings: asRecord(r.settings),
		} satisfies MusicForgeStageRow;
	});
	stages.sort((a, b) => a.sort_order - b.sort_order);
	return stages.filter((s) => s.stage_key);
}

export function modeListLabel(
	mode: MusicForgeModeRow,
	defaultMark: string
): string {
	const title = mode.label_ru.trim() || mode.label_en.trim() || mode.mode_key;
	return mode.is_default ? `${title} · ${defaultMark}` : title;
}
