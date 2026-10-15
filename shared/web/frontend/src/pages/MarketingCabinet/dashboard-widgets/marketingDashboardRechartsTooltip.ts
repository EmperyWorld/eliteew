/**
 * Shared Recharts Tooltip props for dashboard tiles (Wave 23 / D.46).
 * Portal + escape view box avoids clipping by TileChrome body `overflow-y-auto`.
 */
export const MC_DASHBOARD_RECHARTS_TOOLTIP_PORTAL =
	typeof document !== 'undefined' ? document.body : undefined;

export const mcDashboardRechartsTooltipSharedProps = {
	portal: MC_DASHBOARD_RECHARTS_TOOLTIP_PORTAL,
	allowEscapeViewBox: { x: true, y: true } as const,
	wrapperStyle: { zIndex: 30_000 } as const,
};
