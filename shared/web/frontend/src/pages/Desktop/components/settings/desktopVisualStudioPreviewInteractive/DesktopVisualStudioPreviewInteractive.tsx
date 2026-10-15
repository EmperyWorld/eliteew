/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hotspot-driven Visual Studio live preview — orchestrates preview, legend, and popovers.
 *
 * Invariants:
 * - One popover open at a time; reuses profile onChange callbacks from parent.
 * - Legend and demo badges use quiet `VISUAL_STUDIO_PREVIEW_*_CHIP_CLASS` tokens (sentence-case, rounded-md).
 * - Hotspot click opens in-place popover editors; optional footer deep-links to Chrome/Widgets.
 *
 * Related:
 * - `DesktopVisualStudioPreview.tsx`, `DesktopSettingsVisualStudioSection.tsx`
 * - `documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md`
 */

import { cn } from '@/utils/cn';
import {
	useCallback,
	useMemo,
	useRef,
	useState,
	type FC,
	type ReactNode,
	type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../../constants';
import { DESKTOP_SHELL_PARALLAX_INTENSITY_SCALE } from '../../../utils/resolveDesktopShellMotion';
import { DesktopVisualStudioPreview } from '../DesktopVisualStudioPreview';
import {
	type VisualStudioPreviewHotspotHandlers,
	type VisualStudioPreviewHotspotId,
	VISUAL_STUDIO_HOTSPOT_LEGEND_KEY,
	VISUAL_STUDIO_PREVIEW_DEMO_CHIP_CLASS,
	VISUAL_STUDIO_PREVIEW_HOTSPOT_ORDER,
	VISUAL_STUDIO_PREVIEW_LEGEND_CHIP_CLASS,
	visualStudioHotspotNavigateTarget,
} from '../desktopVisualStudioPreviewHotspots';
import {
	popoverTitle,
	renderHotspotPopoverContent,
	type HotspotPopoverContentDeps,
} from './hotspotPopoverContent';
import type { DesktopVisualStudioPreviewInteractiveProps } from './types';
import { VisualStudioHotspotPopover } from './VisualStudioHotspotPopover';

export const DesktopVisualStudioPreviewInteractive: FC<
	DesktopVisualStudioPreviewInteractiveProps
> = ({
	visualLabels,
	onOpenWallpaperPicker,
	onDesktopWindowStyleChange,
	onDesktopTaskbarStyleChange,
	onDesktopWidgetsStyleChange,
	onDesktopPanelOpacityChange,
	onDesktopSceneDepthChange,
	onDesktopFontBodyChange,
	onDesktopFontDisplayChange,
	onDesktopShellParallaxEnabledChange,
	onDesktopShellParallaxIntensityChange,
	onDesktopShellWindowMorphEnabledChange,
	onDesktopShellMotionSpeedChange,
	onDesktopShellReduceMotionChange,
	onDesktopWallpaperCrossfadeChange,
	onDesktopStyledTooltipsChange,
	desktopWallpaperCrossfadeEnabled,
	desktopStyledTooltips,
	shellCheckboxClass,
	onNavigateSettingsField,
	desktopPanelOpacity,
	desktopTaskbarStyle,
	desktopWidgetsStyle,
	desktopWindowStyle,
	desktopSceneDepth,
	desktopFontBody,
	desktopFontDisplay,
	desktopShellReduceMotion,
	desktopShellParallaxEnabled,
	desktopShellParallaxIntensity,
	desktopShellWindowMorphEnabled,
	desktopShellMotionSpeed,
	stageDensity = 'comfortable',
	...previewProps
}) => {
	const { t } = useTranslation('desktopUi');
	const compactStudio = stageDensity === 'compact';
	const [activeHotspot, setActiveHotspot] =
		useState<VisualStudioPreviewHotspotId | null>(null);
	const [previewHovered, setPreviewHovered] = useState(false);
	const anchorElementsRef = useRef<
		Partial<Record<VisualStudioPreviewHotspotId, HTMLElement>>
	>({});

	const registerAnchor = useCallback(
		(id: VisualStudioPreviewHotspotId, element: HTMLElement | null) => {
			if (element) {
				anchorElementsRef.current[id] = element;
				return;
			}
			delete anchorElementsRef.current[id];
		},
		[]
	);

	const anchorRefFor = (
		id: VisualStudioPreviewHotspotId
	): RefObject<HTMLElement | null> => ({
		get current() {
			return anchorElementsRef.current[id] ?? null;
		},
	});

	const closePopover = useCallback(() => setActiveHotspot(null), []);

	const onHotspotClick = useCallback(
		(id: VisualStudioPreviewHotspotId, anchor?: HTMLElement | null) => {
			if (anchor) {
				registerAnchor(id, anchor);
			}
			setActiveHotspot((prev) => (prev === id ? null : id));
		},
		[registerAnchor]
	);

	const hotspotHandlers = useMemo<VisualStudioPreviewHotspotHandlers>(
		() => ({
			activeHotspot,
			onHotspotClick,
			pauseMorphDemo: activeHotspot !== null || previewHovered,
			registerAnchor,
		}),
		[activeHotspot, onHotspotClick, previewHovered, registerAnchor]
	);

	const previewDemoBadges = useMemo(() => {
		const parallaxScale =
			DESKTOP_SHELL_PARALLAX_INTENSITY_SCALE[desktopShellParallaxIntensity] ??
			1;
		return {
			parallax:
				!desktopShellReduceMotion &&
				desktopShellParallaxEnabled &&
				parallaxScale > 0,
			morph: !desktopShellReduceMotion && desktopShellWindowMorphEnabled,
		};
	}, [
		desktopShellParallaxEnabled,
		desktopShellParallaxIntensity,
		desktopShellReduceMotion,
		desktopShellWindowMorphEnabled,
	]);

	const popoverContentDeps = useMemo<HotspotPopoverContentDeps>(
		() => ({
			t,
			visualLabels,
			shellCheckboxClass,
			closePopover,
			onOpenWallpaperPicker,
			onDesktopWindowStyleChange,
			onDesktopTaskbarStyleChange,
			onDesktopWidgetsStyleChange,
			onDesktopPanelOpacityChange,
			onDesktopSceneDepthChange,
			onDesktopFontBodyChange,
			onDesktopFontDisplayChange,
			onDesktopShellParallaxEnabledChange,
			onDesktopShellParallaxIntensityChange,
			onDesktopShellWindowMorphEnabledChange,
			onDesktopShellMotionSpeedChange,
			onDesktopShellReduceMotionChange,
			onDesktopWallpaperCrossfadeChange,
			onDesktopStyledTooltipsChange,
			desktopWallpaperCrossfadeEnabled,
			desktopStyledTooltips,
			desktopPanelOpacity,
			desktopTaskbarStyle,
			desktopWidgetsStyle,
			desktopWindowStyle,
			desktopSceneDepth,
			desktopFontBody,
			desktopFontDisplay,
			desktopShellReduceMotion,
			desktopShellParallaxEnabled,
			desktopShellParallaxIntensity,
			desktopShellWindowMorphEnabled,
			desktopShellMotionSpeed,
		}),
		[
			t,
			visualLabels,
			shellCheckboxClass,
			closePopover,
			onOpenWallpaperPicker,
			onDesktopWindowStyleChange,
			onDesktopTaskbarStyleChange,
			onDesktopWidgetsStyleChange,
			onDesktopPanelOpacityChange,
			onDesktopSceneDepthChange,
			onDesktopFontBodyChange,
			onDesktopFontDisplayChange,
			onDesktopShellParallaxEnabledChange,
			onDesktopShellParallaxIntensityChange,
			onDesktopShellWindowMorphEnabledChange,
			onDesktopShellMotionSpeedChange,
			onDesktopShellReduceMotionChange,
			onDesktopWallpaperCrossfadeChange,
			onDesktopStyledTooltipsChange,
			desktopWallpaperCrossfadeEnabled,
			desktopStyledTooltips,
			desktopPanelOpacity,
			desktopTaskbarStyle,
			desktopWidgetsStyle,
			desktopWindowStyle,
			desktopSceneDepth,
			desktopFontBody,
			desktopFontDisplay,
			desktopShellReduceMotion,
			desktopShellParallaxEnabled,
			desktopShellParallaxIntensity,
			desktopShellWindowMorphEnabled,
			desktopShellMotionSpeed,
		]
	);

	const popoverDetailFooter = (id: VisualStudioPreviewHotspotId): ReactNode => {
		if (!onNavigateSettingsField) return null;
		return (
			<button
				type="button"
				className={cn(
					DESKTOP_TYPOGRAPHY.captionInherit,
					'w-full text-left font-medium text-[rgb(var(--desktop-accent-rgb))] underline-offset-2 hover:underline',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={() => {
					onNavigateSettingsField(visualStudioHotspotNavigateTarget(id));
					closePopover();
				}}
			>
				{t('settingsPanel.visualStudio.hotspotOpenDetailCard')}
			</button>
		);
	};

	return (
		<div
			className={cn(
				'group/preview-studio relative',
				compactStudio ? 'space-y-2' : 'space-y-3'
			)}
			onPointerEnter={() => setPreviewHovered(true)}
			onPointerLeave={() => setPreviewHovered(false)}
		>
			{compactStudio ? (
				<p className="sr-only">
					{t('settingsPanel.visualStudio.livePreviewInteractiveHint')}
				</p>
			) : (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'text-(--desktop-text-secondary)'
					)}
				>
					{t('settingsPanel.visualStudio.livePreviewInteractiveHint')}
				</p>
			)}
			<DesktopVisualStudioPreview
				{...previewProps}
				stageDensity={stageDensity}
				desktopWindowStyle={desktopWindowStyle}
				desktopTaskbarStyle={desktopTaskbarStyle}
				desktopWidgetsStyle={desktopWidgetsStyle}
				desktopPanelOpacity={desktopPanelOpacity}
				desktopSceneDepth={desktopSceneDepth}
				desktopFontBody={desktopFontBody}
				desktopFontDisplay={desktopFontDisplay}
				desktopShellReduceMotion={desktopShellReduceMotion}
				desktopShellParallaxEnabled={desktopShellParallaxEnabled}
				desktopShellParallaxIntensity={desktopShellParallaxIntensity}
				desktopShellWindowMorphEnabled={desktopShellWindowMorphEnabled}
				desktopShellMotionSpeed={desktopShellMotionSpeed}
				hotspotHandlers={hotspotHandlers}
			/>

			{(previewDemoBadges.parallax || previewDemoBadges.morph) && (
				<div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
					{previewDemoBadges.parallax ? (
						<span className={VISUAL_STUDIO_PREVIEW_DEMO_CHIP_CLASS}>
							{t('settingsPanel.visualStudio.previewParallaxHint')}
						</span>
					) : null}
					{previewDemoBadges.morph ? (
						<span className={VISUAL_STUDIO_PREVIEW_DEMO_CHIP_CLASS}>
							{t('settingsPanel.visualStudio.previewMorphHint')}
						</span>
					) : null}
				</div>
			)}

			<div
				className={cn('flex flex-wrap', compactStudio ? 'gap-1' : 'gap-1.5')}
				role="toolbar"
				aria-label={t('settingsPanel.visualStudio.hotspotLegendAria')}
			>
				{VISUAL_STUDIO_PREVIEW_HOTSPOT_ORDER.map((id) => {
					const active = activeHotspot === id;
					return (
						<button
							key={id}
							type="button"
							aria-pressed={active}
							aria-expanded={active}
							onClick={(event) => onHotspotClick(id, event.currentTarget)}
							className={cn(
								VISUAL_STUDIO_PREVIEW_LEGEND_CHIP_CLASS,
								DESKTOP_CHROME_FOCUS_VISIBLE,
								active
									? 'border-[rgb(var(--desktop-accent-rgb))] bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-(--desktop-text-primary)'
									: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 text-(--desktop-text-secondary) hover:border-(--desktop-border-strong) hover:text-(--desktop-text-primary)'
							)}
						>
							{t(
								`settingsPanel.visualStudio.${VISUAL_STUDIO_HOTSPOT_LEGEND_KEY[id]}`
							)}
						</button>
					);
				})}
			</div>

			{activeHotspot ? (
				<VisualStudioHotspotPopover
					open
					anchorRef={anchorRefFor(activeHotspot)}
					onClose={closePopover}
					title={popoverTitle(activeHotspot, t)}
					footer={popoverDetailFooter(activeHotspot)}
					width={
						activeHotspot === 'window' ||
						activeHotspot === 'taskbar' ||
						activeHotspot === 'widget'
							? 320
							: 300
					}
				>
					{renderHotspotPopoverContent(activeHotspot, popoverContentDeps)}
				</VisualStudioHotspotPopover>
			) : null}
		</div>
	);
};
