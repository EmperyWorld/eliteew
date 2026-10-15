/**
 * Группировка типов генераций UGS по «приложению» / продукту.
 * Приоритет: `metadata.product_area` из API, иначе эвристика по `type_key`.
 */

import type { GenerationType } from '@/services/api/ugs/types';
import type { JsonObject } from '@/types/common';

export type GenerationTypeWithMeta = GenerationType & {
	metadata?: JsonObject | null;
};

/** Человекочитаемые подписи для известных кодов product_area. */
export const PRODUCT_AREA_LABELS: Record<string, string> = {
	marketing: 'Маркетинговый кабинет',
	presentations: 'Презентации',
	ugs_hub: 'UGS Hub',
	desktop: 'Desktop и встроенные приложения',
	content: 'Контент и редакторы',
	other: 'Прочее UGS',
};

export function inferProductAreaFromTypeKey(typeKey: string): string {
	const k = typeKey.toLowerCase();
	if (
		k.includes('imc') ||
		k.includes('miso') ||
		k.includes('marketing') ||
		k.includes('cabinet_filler')
	) {
		return 'marketing';
	}
	if (
		k.includes('ewrp') ||
		k.includes('slide') ||
		k.includes('presentation') ||
		k.includes('deck')
	) {
		return 'presentations';
	}
	if (
		k.includes('desktop') ||
		k.includes('ai_chat') ||
		k.includes('ensemble')
	) {
		return 'desktop';
	}
	if (
		k.includes('content') ||
		k.includes('document') ||
		k.includes('ultimate') ||
		k.includes('editor')
	) {
		return 'content';
	}
	return 'other';
}

export function getProductAreaGroupId(t: GenerationTypeWithMeta): string {
	const m = t.metadata;
	if (m && typeof m === 'object' && !Array.isArray(m)) {
		const pa = (m as Record<string, unknown>).product_area;
		if (typeof pa === 'string' && pa.trim()) {
			return pa.trim().toLowerCase();
		}
	}
	return inferProductAreaFromTypeKey(t.type_key);
}

export function getProductAreaLabel(areaId: string): string {
	return PRODUCT_AREA_LABELS[areaId] ?? areaId;
}

export function groupGenerationTypesByProductArea(
	types: GenerationTypeWithMeta[]
): { areaId: string; label: string; types: GenerationTypeWithMeta[] }[] {
	const map = new Map<string, GenerationTypeWithMeta[]>();
	for (const t of types) {
		const id = getProductAreaGroupId(t);
		if (!map.has(id)) map.set(id, []);
		map.get(id)?.push(t);
	}
	const rows = [...map.entries()].map(([areaId, list]) => ({
		areaId,
		label: getProductAreaLabel(areaId),
		types: [...list].sort((a, b) =>
			(a.display_name || a.type_key).localeCompare(
				b.display_name || b.type_key,
				'ru'
			)
		),
	}));
	rows.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
	return rows;
}
