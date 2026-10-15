/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * ResizeObserver hook that keeps grid column count in sync with files panel width.
 *
 * Invariants:
 * - Observes the scroll container ref passed from the list body.
 *
 * Related:
 * - `contentManagerFilesGridLayout.ts`
 * - `ContentManagerFilesTab.tsx`
 */
import * as React from 'react';
import { computeGridColumnCountFromWidth } from '../utils/contentManagerFilesGridLayout';

export function useContentManagerFilesGridMeasure(args: {
	isMobile: boolean;
	setGridColumnCount: React.Dispatch<React.SetStateAction<number>>;
}): React.RefObject<HTMLDivElement | null> {
	const { isMobile, setGridColumnCount } = args;
	const gridWidthMeasureRef = React.useRef<HTMLDivElement>(null);

	const measureGridColumns = React.useCallback(() => {
		const el = gridWidthMeasureRef.current;
		if (!el) return;
		const w = el.clientWidth;
		setGridColumnCount(computeGridColumnCountFromWidth(w, isMobile));
	}, [isMobile, setGridColumnCount]);

	React.useLayoutEffect(() => {
		const el = gridWidthMeasureRef.current;
		if (!el) return;
		measureGridColumns();
		const ro = new ResizeObserver(() => {
			measureGridColumns();
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, [measureGridColumns]);

	return gridWidthMeasureRef;
}
