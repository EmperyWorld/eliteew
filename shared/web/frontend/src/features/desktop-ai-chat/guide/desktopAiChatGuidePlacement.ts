/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Place the Desktop AI Chat guide card beside the spotlight without overlap.
 *
 * Invariants:
 * - Card stays in viewport; prefers side with most free space.
 *
 * Related:
 * - features/desktop-ai-chat/DesktopAiChatGuideModal.tsx
 */

export type PlacementRect = {
	left: number;
	top: number;
	width: number;
	height: number;
};

export function clamp(n: number, lo: number, hi: number): number {
	return Math.min(Math.max(n, lo), hi);
}

export function rectsIntersect(a: PlacementRect, b: PlacementRect): boolean {
	return (
		a.left < b.left + b.width &&
		a.left + a.width > b.left &&
		a.top < b.top + b.height &&
		a.top + a.height > b.top
	);
}

/**
 * Ставит карточку рядом со спотлайтом (см. Workflow Builder), без пересечения
 * с расширенной «дырой» и в пределах viewport.
 */
export function computeGuideCardPlacement(
	spotlight: DOMRect,
	cardW: number,
	cardH: number,
	vw: number,
	vh: number,
	spotlightPadding = 10,
	breathing = 10
): { top: number; left: number } {
	const M = 12;
	const G = 16;
	const e = spotlightPadding + breathing;
	const forbid: PlacementRect = {
		left: spotlight.left - e,
		top: spotlight.top - e,
		width: spotlight.width + 2 * e,
		height: spotlight.height + 2 * e,
	};

	const tryCandidate = (
		left: number,
		top: number
	): { top: number; left: number } | null => {
		const c: PlacementRect = {
			left: clamp(left, M, vw - cardW - M),
			top: clamp(top, M, vh - cardH - M),
			width: cardW,
			height: cardH,
		};
		if (rectsIntersect(c, forbid)) return null;
		return { left: c.left, top: c.top };
	};

	const cy = forbid.top + forbid.height / 2 - cardH / 2;
	const cx = forbid.left + forbid.width / 2 - cardW / 2;

	const candidates: Array<{ left: number; top: number; space: number }> = [
		{
			left: forbid.left + forbid.width + G,
			top: cy,
			space: vw - (forbid.left + forbid.width) - M,
		},
		{
			left: forbid.left - G - cardW,
			top: cy,
			space: forbid.left - M,
		},
		{
			left: cx,
			top: forbid.top + forbid.height + G,
			space: vh - (forbid.top + forbid.height) - M,
		},
		{
			left: cx,
			top: forbid.top - G - cardH,
			space: forbid.top - M,
		},
	];

	const sorted = [...candidates].sort((a, b) => b.space - a.space);
	for (const { left, top } of sorted) {
		const res = tryCandidate(left, top);
		if (res) return res;
	}

	let fallback: PlacementRect = {
		left: clamp(cx, M, vw - cardW - M),
		top: M,
		width: cardW,
		height: cardH,
	};
	if (!rectsIntersect(fallback, forbid)) {
		return { left: fallback.left, top: fallback.top };
	}

	fallback = {
		left: M,
		top: clamp(cy, M, vh - cardH - M),
		width: cardW,
		height: cardH,
	};
	if (!rectsIntersect(fallback, forbid)) {
		return { left: fallback.left, top: fallback.top };
	}

	fallback = {
		left: vw - cardW - M,
		top: clamp(cy, M, vh - cardH - M),
		width: cardW,
		height: cardH,
	};
	if (!rectsIntersect(fallback, forbid)) {
		return { left: fallback.left, top: fallback.top };
	}

	return { left: M, top: M };
}
