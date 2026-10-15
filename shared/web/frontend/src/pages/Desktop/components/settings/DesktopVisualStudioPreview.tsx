/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Live composite preview for Desktop Settings Visual Studio (wallpaper + chrome + motion demo).
 *
 * Invariants:
 * - Presentational only; motion props reflect current Visual Studio form state.
 * - Hotspot / morph / badge chips use `VISUAL_STUDIO_PREVIEW_CHIP_CLASS` (sentence-case).
 * - Stage frame uses `VISUAL_STUDIO_PREVIEW_STAGE_CLASS` (quiet panel depth, no heavy drop shadow).
 * - Morph chip copy uses `previewIconLabel` — not English hardcode.
 * - Outer stage has no composite remount key; morph hold is calm (~2.4s × speed scale).
 *
 * Related:
 * - `DesktopSettingsVisualStudioSection.tsx`, `desktopVisualStudioPreviewHotspots.ts`
 * - `documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md` §1.7
 */

import { cn } from '@/utils/cn';
import { LayoutGroup, motion } from 'framer-motion';
import type { FC, PointerEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
	DesktopFontBodyId,
	DesktopFontDisplayId,
	DesktopIconStyle,
	DesktopSceneDepth,
	DesktopShellMotionSpeed,
	DesktopShellParallaxIntensity,
	DesktopTaskbarStyle,
	DesktopWidgetsStyle,
	DesktopWindowStyle,
} from '@/types/profile';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { computeWallpaperParallaxOffsetPct } from '../../hooks/useDesktopWallpaperParallax';
import {
	desktopShellLayoutTransition,
	desktopShellMotionSpeedScale,
	desktopShellTransitionDurationSec,
	desktopWindowMorphLayoutId,
} from '../../utils/desktopShellMotion';
import { DESKTOP_SHELL_PARALLAX_INTENSITY_SCALE } from '../../utils/resolveDesktopShellMotion';
import {
	resolveDesktopFontDisplayStack,
	resolveDesktopFontFamilyStack,
} from '../../utils/desktopTypography';
import {
	DesktopSettingsWallpaperPreview,
	DesktopTaskbarStyleMiniPreview,
	DesktopWidgetsStyleMiniPreview,
	DesktopWindowStyleMiniPreview,
} from './desktopSettingsPreviewComponents';
import {
	type VisualStudioPreviewHotspotHandlers,
	type VisualStudioPreviewHotspotId,
	VISUAL_STUDIO_HOTSPOT_HINT_KEY,
	VISUAL_STUDIO_PREVIEW_CHIP_CLASS,
	VISUAL_STUDIO_PREVIEW_HOVER_HINT_CLASS,
	VISUAL_STUDIO_PREVIEW_STAGE_CLASS,
	visualStudioPreviewHotspotButtonClass,
} from './desktopVisualStudioPreviewHotspots';

const PREVIEW_MORPH_WINDOW_ID = 'visual-studio-preview';

const HOTSPOT_ARIA_KEY: Record<
	VisualStudioPreviewHotspotId,
	| 'hotspotSceneAria'
	| 'hotspotDisplayFontAria'
	| 'hotspotBodyFontAria'
	| 'hotspotWindowAria'
	| 'hotspotTaskbarAria'
	| 'hotspotWidgetAria'
	| 'hotspotMorphAria'
	| 'hotspotMotionAria'
> = {
	scene: 'hotspotSceneAria',
	displayFont: 'hotspotDisplayFontAria',
	bodyFont: 'hotspotBodyFontAria',
	window: 'hotspotWindowAria',
	taskbar: 'hotspotTaskbarAria',
	widget: 'hotspotWidgetAria',
	morph: 'hotspotMorphAria',
	motion: 'hotspotMotionAria',
};

function PreviewHotspotRegion({
	hotspotId,
	handlers,
	className,
	chipLabel,
	children,
}: {
	hotspotId: VisualStudioPreviewHotspotId;
	handlers?: VisualStudioPreviewHotspotHandlers;
	className?: string;
	chipLabel?: string;
	children: ReactNode;
}) {
	const { t } = useTranslation('desktopUi');
	const setAnchorRef = useCallback(
		(element: HTMLButtonElement | null) => {
			handlers?.registerAnchor(hotspotId, element);
		},
		[handlers, hotspotId]
	);

	if (!handlers) {
		return <div className={className}>{children}</div>;
	}

	const active = handlers.activeHotspot === hotspotId;
	const hintLabel = t(
		`settingsPanel.visualStudio.${VISUAL_STUDIO_HOTSPOT_HINT_KEY[hotspotId]}`
	);
	return (
		<div className={cn('group/hotspot relative', className)}>
			{children}
			<span
				aria-hidden
				className={cn(
					VISUAL_STUDIO_PREVIEW_HOVER_HINT_CLASS,
					'group-hover/hotspot:opacity-100 group-focus-within/hotspot:opacity-100',
					active && 'opacity-100'
				)}
			>
				{hintLabel}
			</span>
			<button
				ref={setAnchorRef}
				type="button"
				className={visualStudioPreviewHotspotButtonClass(
					active,
					Boolean(chipLabel)
				)}
				aria-label={t(
					`settingsPanel.visualStudio.${HOTSPOT_ARIA_KEY[hotspotId]}`
				)}
				aria-expanded={active}
				onClick={(event) =>
					handlers.onHotspotClick(hotspotId, event.currentTarget)
				}
			>
				{chipLabel}
			</button>
		</div>
	);
}

export type DesktopVisualStudioPreviewProps = {
	wallpaper: string;
	theme: 'dark' | 'light' | 'auto';
	desktopWindowStyle: DesktopWindowStyle;
	desktopTaskbarStyle: DesktopTaskbarStyle;
	desktopWidgetsStyle: DesktopWidgetsStyle;
	desktopIconStyle: DesktopIconStyle;
	desktopPanelOpacity: number;
	desktopSceneDepth: DesktopSceneDepth;
	desktopFontBody: DesktopFontBodyId;
	desktopFontDisplay: DesktopFontDisplayId;
	accentLabel?: string;
	desktopShellReduceMotion: boolean;
	desktopShellParallaxEnabled: boolean;
	desktopShellParallaxIntensity: DesktopShellParallaxIntensity;
	desktopShellWindowMorphEnabled: boolean;
	desktopShellMotionSpeed: DesktopShellMotionSpeed;
	className?: string;
	/**
	 * Sticky Personalize preview-only uses compact stage height so the
	 * look theatre does not consume ~½ of the Settings panel.
	 */
	stageDensity?: 'comfortable' | 'compact';
	hotspotHandlers?: VisualStudioPreviewHotspotHandlers;
};

export const DesktopVisualStudioPreview: FC<
	DesktopVisualStudioPreviewProps
> = ({
	wallpaper,
	theme,
	desktopWindowStyle,
	desktopTaskbarStyle,
	desktopWidgetsStyle,
	desktopIconStyle,
	desktopPanelOpacity,
	desktopSceneDepth,
	desktopFontBody,
	desktopFontDisplay,
	accentLabel,
	desktopShellReduceMotion,
	desktopShellParallaxEnabled,
	desktopShellParallaxIntensity,
	desktopShellWindowMorphEnabled,
	desktopShellMotionSpeed,
	className,
	stageDensity = 'comfortable',
	hotspotHandlers,
}) => {
	const compactStage = stageDensity === 'compact';
	const { t } = useTranslation('desktopUi');
	const bodyStack = resolveDesktopFontFamilyStack(desktopFontBody);
	const displayStack = resolveDesktopFontDisplayStack(
		desktopFontDisplay,
		bodyStack
	);
	const isLight = theme === 'light';
	const reduceMotion = desktopShellReduceMotion;
	const speed = desktopShellMotionSpeed;
	const parallaxScale =
		DESKTOP_SHELL_PARALLAX_INTENSITY_SCALE[desktopShellParallaxIntensity] ?? 1;
	const enterDurationSec = desktopShellTransitionDurationSec(
		reduceMotion,
		speed,
		0.24
	);
	const [morphMinimized, setMorphMinimized] = useState(false);
	const [parallaxOffset, setParallaxOffset] = useState({ x: '0%', y: '0%' });

	const morphActive =
		!reduceMotion && desktopShellWindowMorphEnabled && morphMinimized;
	const parallaxActive =
		!reduceMotion && desktopShellParallaxEnabled && parallaxScale > 0;

	useEffect(() => {
		if (
			!desktopShellWindowMorphEnabled ||
			reduceMotion ||
			hotspotHandlers?.pauseMorphDemo
		) {
			setMorphMinimized(false);
			return;
		}
		const holdMs = Math.max(
			1800,
			Math.round(2400 * desktopShellMotionSpeedScale(speed))
		);
		const timer = window.setInterval(() => {
			setMorphMinimized((prev) => !prev);
		}, holdMs);
		return () => window.clearInterval(timer);
	}, [
		desktopShellWindowMorphEnabled,
		hotspotHandlers?.pauseMorphDemo,
		reduceMotion,
		speed,
	]);

	const onPreviewPointerMove = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (!parallaxActive || event.pointerType !== 'mouse') return;
			const rect = event.currentTarget.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) return;
			const nx = (event.clientX - rect.left) / rect.width - 0.5;
			const ny = (event.clientY - rect.top) / rect.height - 0.5;
			const offset = computeWallpaperParallaxOffsetPct(
				nx,
				ny,
				desktopSceneDepth,
				parallaxScale
			);
			setParallaxOffset(offset);
		},
		[desktopSceneDepth, parallaxActive, parallaxScale]
	);

	const onPreviewPointerLeave = useCallback(() => {
		setParallaxOffset({ x: '0%', y: '0%' });
	}, []);

	const morphChipClass = useMemo(
		() =>
			cn(
				'flex h-8 min-w-8 items-center justify-center rounded-md border border-white/20 bg-white/12 px-1.5 shadow-sm backdrop-blur-md',
				VISUAL_STUDIO_PREVIEW_CHIP_CLASS,
				'text-white/92',
				desktopIconStyle === 'minimal' && 'rounded-md bg-white/10'
			),
		[desktopIconStyle]
	);

	return (
		<motion.div
			initial={reduceMotion ? false : { opacity: 0.92, scale: 0.992 }}
			animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
			transition={
				reduceMotion
					? { duration: 0 }
					: { duration: enterDurationSec, ease: [0.16, 1, 0.3, 1] }
			}
			className={cn(VISUAL_STUDIO_PREVIEW_STAGE_CLASS, className)}
			data-desktop-scene-depth={desktopSceneDepth}
			onPointerMove={onPreviewPointerMove}
			onPointerLeave={onPreviewPointerLeave}
			style={{
				fontFamily: bodyStack,
				['--desktop-font-family' as string]: bodyStack,
				['--desktop-font-display' as string]: displayStack,
			}}
		>
			<div
				className="absolute inset-0"
				style={{
					backgroundPosition: parallaxActive
						? `calc(50% + ${parallaxOffset.x}) calc(50% + ${parallaxOffset.y})`
						: '50% 50%',
					transition: reduceMotion
						? undefined
						: 'background-position 0.12s ease-out',
				}}
			>
				<DesktopSettingsWallpaperPreview
					wallpaper={wallpaper}
					className="absolute inset-0 h-full w-full"
				/>
			</div>
			<div
				aria-hidden
				className={cn(
					'pointer-events-none absolute inset-0',
					desktopSceneDepth === 'soft' &&
						'bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.22)_100%)]',
					desktopSceneDepth === 'balanced' &&
						'bg-[radial-gradient(ellipse_at_center,transparent_28%,rgba(0,0,0,0.38)_100%)]',
					desktopSceneDepth === 'immersive' &&
						'bg-[radial-gradient(ellipse_at_center,transparent_12%,rgba(0,0,0,0.52)_100%)]'
				)}
			/>
			<div
				aria-hidden
				className={cn(
					'pointer-events-none absolute inset-0',
					isLight ? 'bg-white/12' : 'bg-black/18'
				)}
			/>
			<LayoutGroup id="visual-studio-preview">
				<div
					className={cn(
						'relative flex flex-col justify-between',
						compactStage
							? 'h-[11.5rem] max-h-[13.75rem] min-h-[10rem] p-2.5 sm:h-[12.5rem] sm:p-3'
							: 'min-h-64 p-3.5 sm:min-h-72 sm:p-4'
					)}
					data-stage-density={stageDensity}
				>
					<div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
						{hotspotHandlers ? (
							<PreviewHotspotRegion
								hotspotId="widget"
								handlers={hotspotHandlers}
								className="w-29"
							>
								<DesktopWidgetsStyleMiniPreview style={desktopWidgetsStyle} />
							</PreviewHotspotRegion>
						) : (
							<div className="w-29">
								<DesktopWidgetsStyleMiniPreview style={desktopWidgetsStyle} />
							</div>
						)}
					</div>
					<div className="flex items-start justify-between gap-2 pr-31">
						<div className="min-w-0 flex-1">
							<PreviewHotspotRegion
								hotspotId="bodyFont"
								handlers={hotspotHandlers}
								className="inline-block max-w-full"
							>
								<p
									className={cn(
										VISUAL_STUDIO_PREVIEW_CHIP_CLASS,
										'text-white/78'
									)}
								>
									{t('settingsPanel.visualStudio.previewBadge')}
								</p>
							</PreviewHotspotRegion>
							<PreviewHotspotRegion
								hotspotId="displayFont"
								handlers={hotspotHandlers}
								className="mt-1 inline-block w-fit max-w-full"
							>
								<p
									className={cn(
										'desktop-shell-display-text truncate font-semibold tracking-tight text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]',
										compactStage ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
									)}
									style={{ fontFamily: displayStack }}
								>
									{t('settingsPanel.visualStudio.previewTitle')}
								</p>
							</PreviewHotspotRegion>
							{accentLabel ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.small,
										'mt-0.5 text-white/78'
									)}
								>
									{accentLabel}
								</p>
							) : null}
							{hotspotHandlers ? (
								<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
									<PreviewHotspotRegion
										hotspotId="scene"
										handlers={hotspotHandlers}
										className="inline-flex h-7 min-w-16"
										chipLabel={t('settingsPanel.visualStudio.hotspotSceneChip')}
									>
										<span className="sr-only">
											{t('settingsPanel.visualStudio.hotspotSceneAria')}
										</span>
									</PreviewHotspotRegion>
									<PreviewHotspotRegion
										hotspotId="motion"
										handlers={hotspotHandlers}
										className="inline-flex h-7 min-w-16"
										chipLabel={t(
											'settingsPanel.visualStudio.hotspotMotionChip'
										)}
									>
										<span className="sr-only">
											{t('settingsPanel.visualStudio.hotspotMotionAria')}
										</span>
									</PreviewHotspotRegion>
								</div>
							) : null}
						</div>
					</div>

					<div className="relative mx-auto w-full max-w-64 shrink-0 py-1">
						<PreviewHotspotRegion
							hotspotId="window"
							handlers={hotspotHandlers}
							className="w-full"
						>
							<DesktopWindowStyleMiniPreview style={desktopWindowStyle} />
						</PreviewHotspotRegion>
						{!morphActive ? (
							<PreviewHotspotRegion
								hotspotId="morph"
								handlers={hotspotHandlers}
								className="absolute right-3 bottom-3 z-20 size-8"
							>
								<motion.span
									layoutId={desktopWindowMorphLayoutId(PREVIEW_MORPH_WINDOW_ID)}
									className={morphChipClass}
									transition={desktopShellLayoutTransition(reduceMotion, speed)}
								>
									{t('settingsPanel.visualStudio.previewIconLabel')}
								</motion.span>
							</PreviewHotspotRegion>
						) : null}
					</div>

					<div className="relative mt-3 shrink-0">
						<PreviewHotspotRegion
							hotspotId="taskbar"
							handlers={hotspotHandlers}
							className="w-full"
						>
							<DesktopTaskbarStyleMiniPreview
								style={desktopTaskbarStyle}
								panelOpacity={desktopPanelOpacity}
							/>
						</PreviewHotspotRegion>
						{morphActive ? (
							<PreviewHotspotRegion
								hotspotId="morph"
								handlers={hotspotHandlers}
								className="absolute bottom-2 left-1/2 z-30 size-8 -translate-x-1/2"
							>
								<motion.span
									layoutId={desktopWindowMorphLayoutId(PREVIEW_MORPH_WINDOW_ID)}
									className={morphChipClass}
									transition={desktopShellLayoutTransition(reduceMotion, speed)}
								>
									{t('settingsPanel.visualStudio.previewIconLabel')}
								</motion.span>
							</PreviewHotspotRegion>
						) : null}
					</div>
				</div>
			</LayoutGroup>
		</motion.div>
	);
};
