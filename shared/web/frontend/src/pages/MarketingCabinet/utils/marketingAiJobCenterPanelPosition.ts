/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fixed-position layout for Marketing Cabinet AI job center dropdown (portal under shell root).
 *
 * Invariants:
 * - Panel opens below trigger; right edges align when viewport allows.
 *
 * Related:
 * - components/MarketingAiJobCenter.tsx
 */
import type { CSSProperties } from 'react';

const PANEL_WIDTH_PX = 352;
const PANEL_GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 10;

export function computeMarketingAiJobCenterPanelStyle(
	trigger: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>,
	zIndex: number,
	win: Pick<Window, 'innerWidth' | 'innerHeight'> = window
): CSSProperties {
	const vw = win.innerWidth;
	const vh = win.innerHeight;
	const width = Math.min(PANEL_WIDTH_PX, vw - VIEWPORT_MARGIN_PX * 2);
	let left = trigger.right - width;
	left = Math.max(
		VIEWPORT_MARGIN_PX,
		Math.min(left, vw - VIEWPORT_MARGIN_PX - width)
	);
	const maxHeight = Math.min(
		320,
		Math.max(120, vh - trigger.bottom - PANEL_GAP_PX - VIEWPORT_MARGIN_PX)
	);
	return {
		position: 'fixed',
		top: trigger.bottom + PANEL_GAP_PX,
		left,
		width,
		maxHeight,
		zIndex,
	};
}
