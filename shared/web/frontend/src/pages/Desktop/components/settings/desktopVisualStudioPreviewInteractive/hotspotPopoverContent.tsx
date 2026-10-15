/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hotspot popover titles and inline edit bodies for Visual Studio preview controls.
 *
 * Invariants:
 * - Reuses profile onChange callbacks from parent; no direct persistence.
 *
 * Related:
 * - `DesktopVisualStudioPreviewInteractive.tsx`, `desktopVisualStudioPreviewHotspots.ts`
 */

import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import {
	DESKTOP_FONT_BODY_KEYS,
	DESKTOP_FONT_DISPLAY_KEYS,
	DESKTOP_PANEL_OPACITY_MAX,
	DESKTOP_PANEL_OPACITY_MIN,
	DESKTOP_SCENE_DEPTH_KEYS,
	DESKTOP_SHELL_MOTION_SPEED_KEYS,
	DESKTOP_SHELL_PARALLAX_INTENSITY_KEYS,
	DESKTOP_TASKBAR_STYLE_KEYS,
	type DesktopFontBodyId,
	type DesktopFontDisplayId,
	type DesktopSceneDepth,
	type DesktopShellMotionSpeed,
	type DesktopShellParallaxIntensity,
	type DesktopTaskbarStyle,
	type DesktopWidgetsStyle,
	type DesktopWindowStyle,
} from '@/types/profile';
import { DesktopAppButton } from '../../DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../../constants';
import {
	DESKTOP_FONT_BODY_LABEL_KEYS,
	DESKTOP_FONT_DISPLAY_LABEL_KEYS,
	DESKTOP_SCENE_DEPTH_LABEL_KEYS,
	resolveDesktopFontDisplayStack,
	resolveDesktopFontFamilyStack,
} from '../../../utils/desktopTypography';
import {
	DesktopTaskbarStyleMiniPreview,
	DesktopWidgetsStyleMiniPreview,
	DesktopWindowStyleMiniPreview,
} from '../desktopSettingsPreviewComponents';
import type { DesktopSettingsVisualLabels } from '../desktopSettingsShared.types';
import type { VisualStudioPreviewHotspotId } from '../desktopVisualStudioPreviewHotspots';
import { segmentButtonClass } from './segmentButtonClass';

export type HotspotPopoverContentDeps = {
	t: TFunction<'desktopUi'>;
	visualLabels: DesktopSettingsVisualLabels;
	shellCheckboxClass: string;
	closePopover: () => void;
	onOpenWallpaperPicker: () => void;
	onDesktopWindowStyleChange: (value: DesktopWindowStyle) => void;
	onDesktopTaskbarStyleChange: (value: DesktopTaskbarStyle) => void;
	onDesktopWidgetsStyleChange: (value: DesktopWidgetsStyle) => void;
	onDesktopPanelOpacityChange: (value: number) => void;
	onDesktopSceneDepthChange: (value: DesktopSceneDepth) => void;
	onDesktopFontBodyChange: (value: DesktopFontBodyId) => void;
	onDesktopFontDisplayChange: (value: DesktopFontDisplayId) => void;
	onDesktopShellParallaxEnabledChange: (value: boolean) => void;
	onDesktopShellParallaxIntensityChange: (
		value: DesktopShellParallaxIntensity
	) => void;
	onDesktopShellWindowMorphEnabledChange: (value: boolean) => void;
	onDesktopShellMotionSpeedChange: (value: DesktopShellMotionSpeed) => void;
	onDesktopShellReduceMotionChange: (value: boolean) => void;
	onDesktopWallpaperCrossfadeChange: (value: boolean) => void;
	onDesktopStyledTooltipsChange: (value: boolean) => void;
	desktopWallpaperCrossfadeEnabled: boolean;
	desktopStyledTooltips: boolean;
	desktopPanelOpacity: number;
	desktopTaskbarStyle: DesktopTaskbarStyle;
	desktopWidgetsStyle: DesktopWidgetsStyle;
	desktopWindowStyle: DesktopWindowStyle;
	desktopSceneDepth: DesktopSceneDepth;
	desktopFontBody: DesktopFontBodyId;
	desktopFontDisplay: DesktopFontDisplayId;
	desktopShellReduceMotion: boolean;
	desktopShellParallaxEnabled: boolean;
	desktopShellParallaxIntensity: DesktopShellParallaxIntensity;
	desktopShellWindowMorphEnabled: boolean;
	desktopShellMotionSpeed: DesktopShellMotionSpeed;
};

export function popoverTitle(
	id: VisualStudioPreviewHotspotId,
	t: TFunction<'desktopUi'>
): string {
	switch (id) {
		case 'scene':
			return t('settingsPanel.visualStudio.hotspotSceneTitle');
		case 'displayFont':
			return t('settingsPanel.visualStudio.hotspotDisplayFontTitle');
		case 'bodyFont':
			return t('settingsPanel.visualStudio.hotspotBodyFontTitle');
		case 'window':
			return t('settingsPanel.visualStudio.hotspotWindowTitle');
		case 'taskbar':
			return t('settingsPanel.visualStudio.hotspotTaskbarTitle');
		case 'widget':
			return t('settingsPanel.visualStudio.hotspotWidgetTitle');
		case 'morph':
			return t('settingsPanel.visualStudio.hotspotMorphTitle');
		case 'motion':
			return t('settingsPanel.visualStudio.hotspotMotionTitle');
		default:
			return '';
	}
}

function renderWindowStylePopoverHeader(
	style: DesktopWindowStyle,
	visualLabels: DesktopSettingsVisualLabels
) {
	return (
		<div className="mb-3 overflow-hidden rounded-xl ring-1 ring-(--desktop-border-subtle)">
			<DesktopWindowStyleMiniPreview style={style} />
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.meta,
					'border-t border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/60 px-2.5 py-2 text-(--desktop-text-secondary)'
				)}
			>
				<span className="font-semibold text-(--desktop-text-primary)">
					{visualLabels.windowStyle[style]}
				</span>
				{' — '}
				{visualLabels.windowStyleDesc[style]}
			</p>
		</div>
	);
}

function renderTaskbarStylePopoverHeader(
	style: DesktopTaskbarStyle,
	panelOpacity: number,
	visualLabels: DesktopSettingsVisualLabels
) {
	return (
		<div className="mb-3 overflow-hidden rounded-xl ring-1 ring-(--desktop-border-subtle)">
			<DesktopTaskbarStyleMiniPreview
				style={style}
				panelOpacity={panelOpacity}
			/>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.meta,
					'border-t border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/60 px-2.5 py-2 text-(--desktop-text-secondary)'
				)}
			>
				<span className="font-semibold text-(--desktop-text-primary)">
					{visualLabels.windowStyle[style]}
				</span>
				{' — '}
				{visualLabels.windowStyleDesc[style]}
			</p>
		</div>
	);
}

function renderWidgetStylePopoverHeader(
	style: DesktopWidgetsStyle,
	visualLabels: DesktopSettingsVisualLabels
) {
	return (
		<div className="mb-3 overflow-hidden rounded-xl ring-1 ring-(--desktop-border-subtle)">
			<DesktopWidgetsStyleMiniPreview style={style} />
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.meta,
					'border-t border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/60 px-2.5 py-2 text-(--desktop-text-secondary)'
				)}
			>
				<span className="font-semibold text-(--desktop-text-primary)">
					{visualLabels.windowStyle[style]}
				</span>
				{' — '}
				{visualLabels.windowStyleDesc[style]}
			</p>
		</div>
	);
}

function renderStyleSegmentGrid(
	selected: DesktopWindowStyle | DesktopTaskbarStyle | DesktopWidgetsStyle,
	onSelect: (
		style: DesktopWindowStyle | DesktopTaskbarStyle | DesktopWidgetsStyle
	) => void,
	visualLabels: DesktopSettingsVisualLabels
) {
	return (
		<div className="grid max-h-52 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
			{DESKTOP_TASKBAR_STYLE_KEYS.map((style) => (
				<button
					key={style}
					type="button"
					aria-pressed={selected === style}
					onClick={() => onSelect(style)}
					className={segmentButtonClass(selected === style)}
				>
					{visualLabels.windowStyle[style]}
				</button>
			))}
		</div>
	);
}

export function renderHotspotPopoverContent(
	id: VisualStudioPreviewHotspotId,
	deps: HotspotPopoverContentDeps
): ReactNode {
	const {
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
		onDesktopShellWindowMorphEnabledChange,
		onDesktopShellMotionSpeedChange,
		onDesktopShellReduceMotionChange,
		onDesktopShellParallaxEnabledChange,
		onDesktopShellParallaxIntensityChange,
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
	} = deps;

	const bodyPreviewStack = resolveDesktopFontFamilyStack(desktopFontBody);

	switch (id) {
		case 'scene':
			return (
				<div className="space-y-3">
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className="w-full"
						onClick={() => {
							onOpenWallpaperPicker();
							closePopover();
						}}
					>
						{t('settingsPanel.visualStudio.hotspotChangeWallpaper')}
					</DesktopAppButton>
					<div className="grid grid-cols-1 gap-1.5">
						{DESKTOP_SCENE_DEPTH_KEYS.map((depth) => (
							<button
								key={depth}
								type="button"
								aria-pressed={desktopSceneDepth === depth}
								onClick={() => onDesktopSceneDepthChange(depth)}
								className={segmentButtonClass(desktopSceneDepth === depth)}
							>
								{t(DESKTOP_SCENE_DEPTH_LABEL_KEYS[depth])}
							</button>
						))}
					</div>
				</div>
			);
		case 'displayFont':
			return (
				<div className="grid grid-cols-2 gap-1.5">
					{DESKTOP_FONT_DISPLAY_KEYS.map((fontId) => (
						<button
							key={fontId}
							type="button"
							aria-pressed={desktopFontDisplay === fontId}
							onClick={() => onDesktopFontDisplayChange(fontId)}
							className={segmentButtonClass(desktopFontDisplay === fontId)}
							style={{
								fontFamily: resolveDesktopFontDisplayStack(
									fontId,
									bodyPreviewStack
								),
							}}
						>
							{t(DESKTOP_FONT_DISPLAY_LABEL_KEYS[fontId])}
						</button>
					))}
				</div>
			);
		case 'bodyFont':
			return (
				<div className="grid grid-cols-2 gap-1.5">
					{DESKTOP_FONT_BODY_KEYS.map((fontId) => (
						<button
							key={fontId}
							type="button"
							aria-pressed={desktopFontBody === fontId}
							onClick={() => onDesktopFontBodyChange(fontId)}
							className={segmentButtonClass(desktopFontBody === fontId)}
							style={{ fontFamily: resolveDesktopFontFamilyStack(fontId) }}
						>
							{t(DESKTOP_FONT_BODY_LABEL_KEYS[fontId])}
						</button>
					))}
				</div>
			);
		case 'window':
			return (
				<>
					{renderWindowStylePopoverHeader(desktopWindowStyle, visualLabels)}
					{renderStyleSegmentGrid(
						desktopWindowStyle,
						onDesktopWindowStyleChange,
						visualLabels
					)}
				</>
			);
		case 'taskbar':
			return (
				<div className="space-y-3">
					{renderTaskbarStylePopoverHeader(
						desktopTaskbarStyle,
						desktopPanelOpacity,
						visualLabels
					)}
					{renderStyleSegmentGrid(
						desktopTaskbarStyle,
						onDesktopTaskbarStyleChange,
						visualLabels
					)}
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between gap-2 text-xs">
							<span className="text-(--desktop-text-secondary)">
								{t('settingsPanel.panelOpacityLabel')}
							</span>
							<span className="tabular-nums text-(--desktop-text-primary)">
								{Math.round(desktopPanelOpacity * 100)}%
							</span>
						</div>
						<input
							type="range"
							min={Math.round(DESKTOP_PANEL_OPACITY_MIN * 100)}
							max={Math.round(DESKTOP_PANEL_OPACITY_MAX * 100)}
							step={5}
							value={Math.round(desktopPanelOpacity * 100)}
							disabled={desktopTaskbarStyle === 'glass'}
							aria-label={t('settingsPanel.panelOpacityLabel')}
							aria-valuetext={`${Math.round(desktopPanelOpacity * 100)}%`}
							onChange={(event) =>
								onDesktopPanelOpacityChange(Number(event.target.value) / 100)
							}
							className="w-full accent-[rgb(var(--desktop-accent-rgb))]"
						/>
					</div>
				</div>
			);
		case 'widget':
			return (
				<>
					{renderWidgetStylePopoverHeader(desktopWidgetsStyle, visualLabels)}
					{renderStyleSegmentGrid(
						desktopWidgetsStyle,
						onDesktopWidgetsStyleChange,
						visualLabels
					)}
				</>
			);
		case 'morph':
			return (
				<div className="space-y-2">
					<label className="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							checked={desktopShellWindowMorphEnabled}
							disabled={desktopShellReduceMotion}
							onChange={(event) =>
								onDesktopShellWindowMorphEnabledChange(event.target.checked)
							}
							className={shellCheckboxClass}
						/>
						<span className="text-xs text-(--desktop-text-primary)">
							{t('settingsPanel.visualStudio.windowMorphLabel')}
						</span>
					</label>
					<div className="grid grid-cols-3 gap-1.5">
						{DESKTOP_SHELL_MOTION_SPEED_KEYS.map((speed) => (
							<button
								key={speed}
								type="button"
								aria-pressed={desktopShellMotionSpeed === speed}
								disabled={desktopShellReduceMotion}
								onClick={() => onDesktopShellMotionSpeedChange(speed)}
								className={segmentButtonClass(
									desktopShellMotionSpeed === speed
								)}
							>
								{t(`settingsPanel.visualStudio.shellMotionSpeed_${speed}`)}
							</button>
						))}
					</div>
				</div>
			);
		case 'motion':
			return (
				<div className="space-y-2.5">
					<label className="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							checked={desktopShellReduceMotion}
							onChange={(event) =>
								onDesktopShellReduceMotionChange(event.target.checked)
							}
							className={shellCheckboxClass}
						/>
						<span className="text-xs text-(--desktop-text-primary)">
							{t('settingsPanel.visualStudio.shellReduceMotionLabel')}
						</span>
					</label>
					<label className="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							checked={desktopShellParallaxEnabled}
							disabled={desktopShellReduceMotion}
							onChange={(event) =>
								onDesktopShellParallaxEnabledChange(event.target.checked)
							}
							className={shellCheckboxClass}
						/>
						<span className="text-xs text-(--desktop-text-primary)">
							{t('settingsPanel.visualStudio.wallpaperParallaxLabel')}
						</span>
					</label>
					<div className="grid grid-cols-3 gap-1.5">
						{DESKTOP_SHELL_PARALLAX_INTENSITY_KEYS.map((intensity) => (
							<button
								key={intensity}
								type="button"
								aria-pressed={desktopShellParallaxIntensity === intensity}
								disabled={
									desktopShellReduceMotion || !desktopShellParallaxEnabled
								}
								onClick={() => onDesktopShellParallaxIntensityChange(intensity)}
								className={segmentButtonClass(
									desktopShellParallaxIntensity === intensity
								)}
							>
								{t(`settingsPanel.visualStudio.parallaxIntensity_${intensity}`)}
							</button>
						))}
					</div>
					<label className="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							checked={desktopWallpaperCrossfadeEnabled}
							onChange={(event) =>
								onDesktopWallpaperCrossfadeChange(event.target.checked)
							}
							className={shellCheckboxClass}
						/>
						<span className="text-xs text-(--desktop-text-primary)">
							{t('settingsPanel.visualStudio.wallpaperCrossfadeLabel')}
						</span>
					</label>
					<label className="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							checked={desktopStyledTooltips}
							onChange={(event) =>
								onDesktopStyledTooltipsChange(event.target.checked)
							}
							className={shellCheckboxClass}
						/>
						<span className="text-xs text-(--desktop-text-primary)">
							{t('settingsPanel.visualStudio.styledTooltipsLabel')}
						</span>
					</label>
				</div>
			);
		default:
			return null;
	}
}
