/** Общая геометрия карточки экскурсии (WF builder / desktop AI chat / voice / CM). */

export type GuidePlacementRect = {
	left: number;
	top: number;
	width: number;
	height: number;
};

export type GuideCardPlacementSide =
	| 'right'
	| 'left'
	| 'bottom'
	| 'top'
	| 'center';

export type GuideCardPlacement = {
	top: number;
	left: number;
	side: GuideCardPlacementSide;
};

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(Math.max(n, lo), hi);
}

function rectsIntersect(a: GuidePlacementRect, b: GuidePlacementRect): boolean {
	return (
		a.left < b.left + b.width &&
		a.left + a.width > b.left &&
		a.top < b.top + b.height &&
		a.top + a.height > b.top
	);
}

/**
 * Ставит карточку рядом со спотлайтом без пересечения с расширенной «дырой» и в viewport.
 */
export function computeGuideCardPlacement(
	spotlight: DOMRect,
	cardW: number,
	cardH: number,
	vw: number,
	vh: number,
	spotlightPadding = 10,
	breathing = 10
): GuideCardPlacement {
	const M = 12;
	const G = 16;
	const e = spotlightPadding + breathing;
	const forbid: GuidePlacementRect = {
		left: spotlight.left - e,
		top: spotlight.top - e,
		width: spotlight.width + 2 * e,
		height: spotlight.height + 2 * e,
	};

	const tryCandidate = (
		left: number,
		top: number,
		side: GuideCardPlacementSide
	): GuideCardPlacement | null => {
		const c: GuidePlacementRect = {
			left: clamp(left, M, vw - cardW - M),
			top: clamp(top, M, vh - cardH - M),
			width: cardW,
			height: cardH,
		};
		if (rectsIntersect(c, forbid)) return null;
		return { left: c.left, top: c.top, side };
	};

	const cy = forbid.top + forbid.height / 2 - cardH / 2;
	const cx = forbid.left + forbid.width / 2 - cardW / 2;

	const candidates: Array<{
		left: number;
		top: number;
		space: number;
		side: GuideCardPlacementSide;
	}> = [
		{
			left: forbid.left + forbid.width + G,
			top: cy,
			space: vw - (forbid.left + forbid.width) - M,
			side: 'right',
		},
		{
			left: forbid.left - G - cardW,
			top: cy,
			space: forbid.left - M,
			side: 'left',
		},
		{
			left: cx,
			top: forbid.top + forbid.height + G,
			space: vh - (forbid.top + forbid.height) - M,
			side: 'bottom',
		},
		{
			left: cx,
			top: forbid.top - G - cardH,
			space: forbid.top - M,
			side: 'top',
		},
	];

	const sorted = [...candidates].sort((a, b) => b.space - a.space);
	for (const { left, top, side } of sorted) {
		const res = tryCandidate(left, top, side);
		if (res) return res;
	}

	let fallback: GuidePlacementRect = {
		left: clamp(cx, M, vw - cardW - M),
		top: M,
		width: cardW,
		height: cardH,
	};
	if (!rectsIntersect(fallback, forbid)) {
		return { left: fallback.left, top: fallback.top, side: 'bottom' };
	}

	fallback = {
		left: M,
		top: clamp(cy, M, vh - cardH - M),
		width: cardW,
		height: cardH,
	};
	if (!rectsIntersect(fallback, forbid)) {
		return { left: fallback.left, top: fallback.top, side: 'left' };
	}

	fallback = {
		left: vw - cardW - M,
		top: clamp(cy, M, vh - cardH - M),
		width: cardW,
		height: cardH,
	};
	if (!rectsIntersect(fallback, forbid)) {
		return { left: fallback.left, top: fallback.top, side: 'right' };
	}

	return { left: M, top: M, side: 'center' };
}
