/** Helpers for A.12 dashboard time-to-interactive (no PII). */

export function countVisibleMarketingDashboardWidgets(
	widgets: ReadonlyArray<{ is_visible?: boolean }>
): number {
	return widgets.filter((x) => x.is_visible).length;
}
