/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Grid column math and explorer depth padding tokens for Content Manager files panel.
 *
 * Invariants:
 * - Desktop grid track size matches `minmax(11rem,1fr)` + `gap-3` (12px).
 *
 * Related:
 * - `ContentManagerFilesTab.tsx`
 * - `useContentManagerFilesGridMeasure.ts`
 */

/** Отступ ветки проводника по глубине (12px на уровень), без inline `style` для webhint. */
export const CM_EXPLORER_DEPTH_PS: readonly string[] = [
	'ps-0',
	'ps-[12px]',
	'ps-[24px]',
	'ps-[36px]',
	'ps-[48px]',
	'ps-[60px]',
	'ps-[72px]',
	'ps-[84px]',
	'ps-[96px]',
	'ps-[108px]',
	'ps-[120px]',
	'ps-[132px]',
	'ps-[144px]',
	'ps-[156px]',
	'ps-[168px]',
	'ps-[180px]',
	'ps-[192px]',
	'ps-[204px]',
	'ps-[216px]',
	'ps-[228px]',
	'ps-[240px]',
	'ps-[252px]',
	'ps-[264px]',
	'ps-[276px]',
	'ps-[288px]',
	'ps-[300px]',
	'ps-[312px]',
	'ps-[324px]',
	'ps-[336px]',
	'ps-[348px]',
	'ps-[360px]',
	'ps-[372px]',
	'ps-[384px]',
	'ps-[396px]',
	'ps-[408px]',
	'ps-[420px]',
	'ps-[432px]',
	'ps-[444px]',
	'ps-[456px]',
	'ps-[468px]',
	'ps-[480px]',
	'ps-[492px]',
	'ps-[504px]',
	'ps-[516px]',
	'ps-[528px]',
	'ps-[540px]',
	'ps-[552px]',
	'ps-[564px]',
] as const;

export const CONTENT_MANAGER_DESKTOP_GRID_CLASS =
	'grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]';

/** Must match desktop grid: `minmax(11rem,1fr)` + `gap-3` (12px). Used for keyboard column step. */
export function computeGridColumnCountFromWidth(
	widthPx: number,
	isMobile: boolean
): number {
	if (widthPx <= 0) return 1;
	if (isMobile) {
		if (widthPx < 640) return 1;
		return 2;
	}
	const minTrackPx = 176; // 11rem at 16px root
	const gapPx = 12; // gap-3
	return Math.max(1, Math.floor((widthPx + gapPx) / (minTrackPx + gapPx)));
}
