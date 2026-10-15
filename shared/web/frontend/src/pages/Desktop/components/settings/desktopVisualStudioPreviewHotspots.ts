/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hotspot ids and button chrome for Visual Studio interactive preview regions.
 *
 * Invariants:
 * - Region ids match anchors registered from `DesktopVisualStudioPreview`.
 * - `VISUAL_STUDIO_PREVIEW_CHIP_CLASS` stays sentence-case (no uppercase shout).
 * - Stage / legend / hotspot chrome stays quiet (no heavy drop shadow or accent glow wash).
 * - Hotspots open in-place popovers; optional footer may deep-link to Chrome/Widgets SoT grids.
 *
 * Related:
 * - `DesktopVisualStudioPreview.tsx`, `DesktopVisualStudioPreviewInteractive.tsx`
 * - `documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md`
 * - `documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md` §1.7
 */

import { cn } from '@/utils/cn';
import { buildDesktopSettingsFieldElementId } from '../../utils/desktopSettingsFieldElementIds';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type { TabId } from './desktopSettingsShared.types';

export type VisualStudioPreviewHotspotId =
	| 'scene'
	| 'displayFont'
	| 'bodyFont'
	| 'window'
	| 'taskbar'
	| 'widget'
	| 'morph'
	| 'motion';

export type VisualStudioPreviewHotspotHandlers = {
	activeHotspot: VisualStudioPreviewHotspotId | null;
	onHotspotClick: (
		id: VisualStudioPreviewHotspotId,
		anchor?: HTMLElement | null
	) => void;
	/** Pause morph demo while a popover is open or the preview is hovered. */
	pauseMorphDemo: boolean;
	registerAnchor: (
		id: VisualStudioPreviewHotspotId,
		element: HTMLElement | null
	) => void;
};

export const VISUAL_STUDIO_PREVIEW_HOTSPOT_ORDER: readonly VisualStudioPreviewHotspotId[] =
	[
		'bodyFont',
		'displayFont',
		'scene',
		'window',
		'taskbar',
		'widget',
		'morph',
		'motion',
	] as const;

export const VISUAL_STUDIO_HOTSPOT_HINT_KEY: Record<
	VisualStudioPreviewHotspotId,
	| 'hotspotHintBodyFont'
	| 'hotspotHintDisplayFont'
	| 'hotspotHintScene'
	| 'hotspotHintWindow'
	| 'hotspotHintTaskbar'
	| 'hotspotHintWidget'
	| 'hotspotHintMorph'
	| 'hotspotHintMotion'
> = {
	bodyFont: 'hotspotHintBodyFont',
	displayFont: 'hotspotHintDisplayFont',
	scene: 'hotspotHintScene',
	window: 'hotspotHintWindow',
	taskbar: 'hotspotHintTaskbar',
	widget: 'hotspotHintWidget',
	morph: 'hotspotHintMorph',
	motion: 'hotspotHintMotion',
};

export const VISUAL_STUDIO_HOTSPOT_LEGEND_KEY: Record<
	VisualStudioPreviewHotspotId,
	| 'hotspotLegendBodyFont'
	| 'hotspotLegendDisplayFont'
	| 'hotspotLegendScene'
	| 'hotspotLegendWindow'
	| 'hotspotLegendTaskbar'
	| 'hotspotLegendWidget'
	| 'hotspotLegendMorph'
	| 'hotspotLegendMotion'
> = {
	bodyFont: 'hotspotLegendBodyFont',
	displayFont: 'hotspotLegendDisplayFont',
	scene: 'hotspotLegendScene',
	window: 'hotspotLegendWindow',
	taskbar: 'hotspotLegendTaskbar',
	widget: 'hotspotLegendWidget',
	morph: 'hotspotLegendMorph',
	motion: 'hotspotLegendMotion',
};

export type VisualStudioSettingsNavigateTarget = {
	tab: TabId;
	elementId: string;
};

/**
 * Prefs that also have a full picker on Chrome/Widgets (same keys).
 * Preview edits in-place; optional popover footer may deep-link to that SoT card.
 */
export const VISUAL_STUDIO_LOOK_SOT_HOTSPOTS: readonly VisualStudioPreviewHotspotId[] =
	['window', 'taskbar', 'widget'] as const;

export function isVisualStudioLookSoTHotspot(
	id: VisualStudioPreviewHotspotId
): boolean {
	return (VISUAL_STUDIO_LOOK_SOT_HOTSPOTS as readonly string[]).includes(id);
}

export function visualStudioHotspotNavigateTarget(
	id: VisualStudioPreviewHotspotId
): VisualStudioSettingsNavigateTarget {
	switch (id) {
		case 'window':
			return {
				tab: 'chrome',
				elementId: buildDesktopSettingsFieldElementId(
					'profile_ui',
					'desktop_window_style'
				),
			};
		case 'taskbar':
			return {
				tab: 'chrome',
				elementId: buildDesktopSettingsFieldElementId(
					'profile_ui',
					'desktop_taskbar_style'
				),
			};
		case 'widget':
			return {
				tab: 'widgets',
				elementId: buildDesktopSettingsFieldElementId(
					'profile_ui',
					'desktop_widgets_style'
				),
			};
		case 'bodyFont':
			return {
				tab: 'personalize',
				elementId: buildDesktopSettingsFieldElementId(
					'profile_ui',
					'desktop_font_body'
				),
			};
		case 'displayFont':
			return {
				tab: 'personalize',
				elementId: buildDesktopSettingsFieldElementId(
					'profile_ui',
					'desktop_font_display'
				),
			};
		case 'scene':
			return {
				tab: 'personalize',
				elementId: buildDesktopSettingsFieldElementId(
					'profile_ui',
					'desktop_scene_depth'
				),
			};
		case 'morph':
		case 'motion':
			return {
				tab: 'personalize',
				elementId: buildDesktopSettingsFieldElementId(
					'profile_ui',
					'desktop_shell_motion'
				),
			};
		default:
			return {
				tab: 'personalize',
				elementId: buildDesktopSettingsFieldElementId(
					'profile_ui',
					'visual_studio_preview'
				),
			};
	}
}

export function visualStudioPreviewHotspotButtonClass(
	active: boolean,
	withChipLabel = false
): string {
	return cn(
		'absolute inset-0 z-20 rounded-lg border border-transparent bg-transparent outline-none',
		'transition-[background-color,box-shadow] duration-150',
		DESKTOP_CHROME_FOCUS_VISIBLE,
		'group-hover/hotspot:bg-[rgb(var(--desktop-accent-rgb)/0.06)]',
		'group-hover/hotspot:shadow-[inset_0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.22)]',
		'group-focus-within/hotspot:bg-[rgb(var(--desktop-accent-rgb)/0.06)]',
		'group-focus-within/hotspot:shadow-[inset_0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.22)]',
		active &&
			'bg-[rgb(var(--desktop-accent-rgb)/0.12)] shadow-[inset_0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.42)]',
		withChipLabel &&
			cn(
				'flex items-center justify-center',
				DESKTOP_TYPOGRAPHY.shellMeta10,
				'font-medium tracking-normal text-white/90'
			)
	);
}

/** Legend / hover chips under the live preview — sentence case, not chrome shout. */
export const VISUAL_STUDIO_PREVIEW_CHIP_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'font-medium tracking-normal'
);

/** Live preview stage frame — soft depth, no operator-console drop shadow. */
export const VISUAL_STUDIO_PREVIEW_STAGE_CLASS = cn(
	'relative overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'shadow-(--desktop-shadow-panel) ring-1 ring-white/5',
	'before:pointer-events-none before:absolute before:inset-x-5 before:top-0 before:z-10 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)]'
);

/** Sticky / card shell around interactive preview — quiet hairline, no accent wash. */
export const VISUAL_STUDIO_PREVIEW_SHELL_CLASS = cn(
	'relative overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'bg-(--desktop-surface-panel) p-2.5 shadow-(--desktop-shadow-soft) sm:p-3.5',
	'before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px',
	'before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)]'
);

/** Legend toolbar + demo status chips under the stage. */
export const VISUAL_STUDIO_PREVIEW_LEGEND_CHIP_CLASS = cn(
	VISUAL_STUDIO_PREVIEW_CHIP_CLASS,
	'rounded-md border px-2.5 py-1 transition-colors'
);

export const VISUAL_STUDIO_PREVIEW_DEMO_CHIP_CLASS = cn(
	VISUAL_STUDIO_PREVIEW_CHIP_CLASS,
	'rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/70 px-2.5 py-0.5 text-(--desktop-text-secondary)'
);

/** In-preview hover hint pill over wallpaper. */
export const VISUAL_STUDIO_PREVIEW_HOVER_HINT_CLASS = cn(
	VISUAL_STUDIO_PREVIEW_CHIP_CLASS,
	'pointer-events-none absolute -top-5 left-0 z-30 max-w-[calc(100%+1rem)] truncate rounded-md',
	'border border-white/16 bg-black/55 px-2 py-0.5 text-white/90',
	'opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-150'
);
