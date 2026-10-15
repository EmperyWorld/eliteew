import type {
	MarketingDashboardPreset,
	MarketingDashboardWidget,
} from '../marketingCabinetApi';

export type PresetApplyDiffPreview = {
	/** Human-readable rows for widgets defined in the preset template (may be empty). */
	inPresetRows: string[];
	/** Current layout tiles whose `widget_key` is absent from the preset template. */
	notInPresetRows: string[];
	/** `true` when `template_config.widgets` is a non-empty array (preview is meaningful). */
	hasResolvableTemplate: boolean;
};

function catalogLabel(
	widgetKey: string,
	tt: (key: string, options?: Record<string, unknown>) => string
): string {
	return tt(`overview.dashboard.catalog.${widgetKey}`, {
		defaultValue: widgetKey,
	});
}

function rowForTemplateItem(
	item: Record<string, unknown>,
	index: number,
	tt: (key: string, options?: Record<string, unknown>) => string
): { key: string; row: string } {
	const keyRaw = item.widget_key;
	const key = typeof keyRaw === 'string' ? keyRaw : `unknown-${index}`;
	const title = typeof item.widget_title === 'string' ? item.widget_title : '';
	const cat = catalogLabel(key, tt);
	return {
		key,
		row: title ? `${title} (${cat})` : String(cat),
	};
}

/**
 * Builds preset-apply modal copy: tiles shipped with the preset vs current tiles that will not appear after switching active layout.
 */
export function buildPresetApplyDiffPreview(
	preset: MarketingDashboardPreset,
	currentWidgets: MarketingDashboardWidget[] | null | undefined,
	tt: (key: string, options?: Record<string, unknown>) => string
): PresetApplyDiffPreview {
	const raw = preset.template_config?.widgets;
	if (!Array.isArray(raw) || raw.length === 0) {
		return {
			inPresetRows: [],
			notInPresetRows: [],
			hasResolvableTemplate: false,
		};
	}

	const inPresetRows: string[] = [];
	const templateKeys = new Set<string>();
	for (let i = 0; i < raw.length; i++) {
		const o = raw[i];
		if (!o || typeof o !== 'object') {
			continue;
		}
		const { key, row } = rowForTemplateItem(
			o as Record<string, unknown>,
			i,
			tt
		);
		templateKeys.add(key);
		inPresetRows.push(row);
	}

	const widgets = currentWidgets ?? [];
	const notInPresetRows: string[] = [];
	for (const w of widgets) {
		if (templateKeys.has(w.widget_key)) {
			continue;
		}
		const cat = catalogLabel(w.widget_key, tt);
		const title = w.widget_title?.trim();
		notInPresetRows.push(title ? `${title} (${cat})` : String(cat));
	}

	return {
		inPresetRows,
		notInPresetRows,
		hasResolvableTemplate: true,
	};
}
