/**
 * Dashboard telemetry without backend: CustomEvent for optional analytics hooks.
 * Unknown widget keys are product metadata (not end-user PII).
 */

export const MARKETING_DASHBOARD_TELEMETRY_EVENT =
	'marketing-cabinet-dashboard-telemetry' as const;

export type MarketingDashboardTelemetryDetail =
	| { type: 'unknown_widget_key'; widget_key: string }
	| { type: 'unknown_widget_key_seen'; widget_key: string };

export function emitMarketingDashboardTelemetry(
	detail: MarketingDashboardTelemetryDetail
) {
	if (typeof window === 'undefined') {
		return;
	}
	window.dispatchEvent(
		new CustomEvent(MARKETING_DASHBOARD_TELEMETRY_EVENT, {
			detail,
		})
	);
}

/** Once per widget id per page load — avoids noise from re-renders. */
const _unknownSeen = new Set<string>();

export function telemetryUnknownDashboardWidgetOnce(
	widgetId: string,
	widgetKey: string
) {
	if (!widgetId || !widgetKey) {
		return;
	}
	const k = `${widgetId}:${widgetKey}`;
	if (_unknownSeen.has(k)) {
		return;
	}
	_unknownSeen.add(k);
	emitMarketingDashboardTelemetry({
		type: 'unknown_widget_key_seen',
		widget_key: widgetKey,
	});
	if (
		typeof performance !== 'undefined' &&
		typeof performance.mark === 'function'
	) {
		try {
			performance.mark('mc-dashboard-unknown-widget');
		} catch {
			/* ignore */
		}
	}
}
