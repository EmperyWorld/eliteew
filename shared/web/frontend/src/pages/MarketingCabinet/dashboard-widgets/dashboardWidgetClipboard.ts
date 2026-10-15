import type { MarketingDashboardWidget } from '../marketingCabinetApi';

import { stripExternalHttpUrlsFromJsonValue } from './dashboardImportSecurity';
import { isMarketingDashboardWidgetKey } from './types';

export const MC_DASHBOARD_CLIPBOARD_SCHEMA_VERSION = 1 as const;

export type McDashboardClipboardPayload = {
	schemaVersion: typeof MC_DASHBOARD_CLIPBOARD_SCHEMA_VERSION;
	widget_key: string;
	widget_title: string;
	widget_config: Record<string, unknown>;
	grid_position?: {
		w?: number;
		h?: number;
		minW?: number;
		minH?: number;
		maxW?: number;
		maxH?: number;
	};
};

function pickGridDim(v: unknown): number | undefined {
	if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
	return v;
}

export function buildWidgetsClipboardPayload(
	widget: MarketingDashboardWidget
): McDashboardClipboardPayload {
	const g = widget.grid_position ?? {};
	return {
		schemaVersion: MC_DASHBOARD_CLIPBOARD_SCHEMA_VERSION,
		widget_key: widget.widget_key,
		widget_title: widget.widget_title,
		widget_config:
			widget.widget_config && typeof widget.widget_config === 'object'
				? (widget.widget_config as Record<string, unknown>)
				: {},
		grid_position: {
			w: pickGridDim(g.w),
			h: pickGridDim(g.h),
			minW: pickGridDim(g.minW),
			minH: pickGridDim(g.minH),
			maxW: pickGridDim(g.maxW),
			maxH: pickGridDim(g.maxH),
		},
	};
}

export function parseWidgetsClipboardPayload(
	raw: unknown
): McDashboardClipboardPayload | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	if (o.schemaVersion !== MC_DASHBOARD_CLIPBOARD_SCHEMA_VERSION) return null;
	const widget_key = o.widget_key;
	if (
		typeof widget_key !== 'string' ||
		!isMarketingDashboardWidgetKey(widget_key)
	) {
		return null;
	}
	const widget_title =
		typeof o.widget_title === 'string' && o.widget_title.trim().length > 0
			? o.widget_title.trim()
			: widget_key;
	let widget_config: Record<string, unknown> = {};
	if (
		o.widget_config &&
		typeof o.widget_config === 'object' &&
		!Array.isArray(o.widget_config)
	) {
		widget_config = o.widget_config as Record<string, unknown>;
	}
	let grid_position: McDashboardClipboardPayload['grid_position'];
	if (
		o.grid_position &&
		typeof o.grid_position === 'object' &&
		!Array.isArray(o.grid_position)
	) {
		const gp = o.grid_position as Record<string, unknown>;
		const num = (v: unknown) =>
			typeof v === 'number' && Number.isFinite(v) ? v : undefined;
		grid_position = {
			w: num(gp.w),
			h: num(gp.h),
			minW: num(gp.minW),
			minH: num(gp.minH),
			maxW: num(gp.maxW),
			maxH: num(gp.maxH),
		};
	}
	const safeConfig = stripExternalHttpUrlsFromJsonValue(
		widget_config
	) as Record<string, unknown>;
	return {
		schemaVersion: MC_DASHBOARD_CLIPBOARD_SCHEMA_VERSION,
		widget_key,
		widget_title,
		widget_config: safeConfig,
		grid_position,
	};
}
