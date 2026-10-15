/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared prop types for presentation slide settings tab components.
 *
 * Related:
 * - presentationEdit/PresentationEditSlideSettings*Tab.tsx
 */

import type { PresentationSlide } from '@services/api/presentations';

export type PresentationSlideFieldChangeHandler = (
	index: number,
	field: keyof PresentationSlide,
	value: string | undefined
) => void;

export type PresentationEditSlideSettingsTabBaseProps = {
	slide: PresentationSlide;
	slideIndex: number;
	onSlideChange: PresentationSlideFieldChangeHandler;
};

export type PresentationEditSettingsTabId =
	| 'basic'
	| 'typography'
	| 'colors'
	| 'image';
