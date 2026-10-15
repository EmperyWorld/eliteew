/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dashed bezier connector between floating guide card and spotlight target.
 *
 * Invariants:
 * - Purely decorative (`pointer-events-none`); omitted when card is centered.
 *
 * Related:
 * - SpotlightGuideModal.tsx, guideTourPlacement.ts
 */

import type { GuideCardPlacementSide } from '@/components/guided-tour/guideTourPlacement';

type RectLike = Pick<DOMRect, 'top' | 'left' | 'width' | 'height'>;

function anchorForSide(
	card: RectLike,
	spotlight: RectLike,
	side: GuideCardPlacementSide
): { x1: number; y1: number; x2: number; y2: number } {
	const cardCx = card.left + card.width / 2;
	const cardCy = card.top + card.height / 2;
	const spotCx = spotlight.left + spotlight.width / 2;
	const spotCy = spotlight.top + spotlight.height / 2;

	switch (side) {
		case 'right':
			return {
				x1: card.left,
				y1: cardCy,
				x2: spotlight.left + spotlight.width,
				y2: spotCy,
			};
		case 'left':
			return {
				x1: card.left + card.width,
				y1: cardCy,
				x2: spotlight.left,
				y2: spotCy,
			};
		case 'bottom':
			return {
				x1: cardCx,
				y1: card.top,
				x2: spotCx,
				y2: spotlight.top + spotlight.height,
			};
		case 'top':
			return {
				x1: cardCx,
				y1: card.top + card.height,
				x2: spotCx,
				y2: spotlight.top,
			};
		default:
			return { x1: cardCx, y1: cardCy, x2: spotCx, y2: spotCy };
	}
}

function bezierPath(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	side: GuideCardPlacementSide
): string {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const bend = Math.min(96, Math.max(28, Math.hypot(dx, dy) * 0.28));

	let cx1 = x1;
	let cy1 = y1;
	let cx2 = x2;
	let cy2 = y2;

	switch (side) {
		case 'right':
			cx1 = x1 - bend;
			cy1 = y1;
			cx2 = x2 + bend * 0.35;
			cy2 = y2;
			break;
		case 'left':
			cx1 = x1 + bend;
			cy1 = y1;
			cx2 = x2 - bend * 0.35;
			cy2 = y2;
			break;
		case 'bottom':
			cx1 = x1;
			cy1 = y1 - bend;
			cx2 = x2;
			cy2 = y2 + bend * 0.35;
			break;
		case 'top':
			cx1 = x1;
			cy1 = y1 + bend;
			cx2 = x2;
			cy2 = y2 - bend * 0.35;
			break;
		default:
			cx1 = x1 + dx * 0.35;
			cy1 = y1 + dy * 0.15;
			cx2 = x2 - dx * 0.35;
			cy2 = y2 - dy * 0.15;
			break;
	}

	return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

export function GuideTourCardConnector({
	cardRect,
	spotlightRect,
	side,
	zIndex,
}: {
	cardRect: RectLike;
	spotlightRect: RectLike;
	side: GuideCardPlacementSide;
	zIndex: number;
}) {
	if (side === 'center') return null;

	const { x1, y1, x2, y2 } = anchorForSide(cardRect, spotlightRect, side);
	const path = bezierPath(x1, y1, x2, y2, side);
	const gradId = 'guide-tour-connector-grad';

	return (
		<svg
			className="pointer-events-none fixed inset-0 h-full w-full overflow-visible"
			style={{ zIndex }}
			aria-hidden
			role="presentation"
		>
			<title>Guide tour connector</title>
			<defs>
				<linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="rgba(167,139,250,0.85)" />
					<stop offset="55%" stopColor="rgba(196,181,253,0.55)" />
					<stop offset="100%" stopColor="rgba(157,255,0,0.65)" />
				</linearGradient>
			</defs>
			<path
				d={path}
				fill="none"
				stroke={`url(#${gradId})`}
				strokeWidth={2}
				strokeDasharray="7 9"
				strokeLinecap="round"
				opacity={0.88}
			/>
			<circle cx={x2} cy={y2} r={4.5} fill="rgba(157,255,0,0.85)" />
			<circle
				cx={x2}
				cy={y2}
				r={9}
				fill="none"
				stroke="rgba(157,255,0,0.35)"
				strokeWidth={1.5}
			/>
		</svg>
	);
}
