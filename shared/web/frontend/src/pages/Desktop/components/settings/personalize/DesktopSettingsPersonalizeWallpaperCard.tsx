/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wallpaper CTA + compact thumb for Personalize Look group (sticky VS remains
 * the wallpaper SoT stage — no second giant preview rectangle).
 *
 * Invariants:
 * - Field ids wired for storage map navigation (`desktop_config/wallpaper`).
 * - Idle: Change wallpaper is the sole filled primary CTA above the fold.
 *
 * Related:
 * - `DesktopSettingsPersonalizeTab.tsx`
 * - `desktopSettingsPersonalize.types.ts`
 */

import { cn } from '@/utils/cn';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { DesktopAppButton } from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import { buildDesktopSettingsFieldElementId } from '../../../utils/desktopSettingsFieldElementIds';
import { getDesktopShellToolbarClusterInsetControlClassName } from '../../../utils/desktopVisualSystem';
import { DESKTOP_TYPOGRAPHY } from '../../../constants';
import { DesktopSettingsWallpaperPreview } from '../desktopSettingsPreviewComponents';
import type { DesktopSettingsPersonalizeWallpaperCardProps } from './desktopSettingsPersonalize.types';

export const DesktopSettingsPersonalizeWallpaperCard: FC<
	DesktopSettingsPersonalizeWallpaperCardProps
> = ({ wallpaper, onOpenWallpaperPicker, shell, isPrimaryCta = true }) => {
	const { t: tSettings } = useTranslation('desktopUi');

	return (
		<div
			id={buildDesktopSettingsFieldElementId('desktop_config', 'wallpaper')}
			className="scroll-mt-20"
			data-testid="desktop-settings-wallpaper-look-row"
		>
			<div
				id={buildDesktopSettingsFieldElementId(
					'desktop_config',
					'live_wallpaper'
				)}
				className="scroll-mt-20"
				aria-hidden
			/>
			<div
				id={buildDesktopSettingsFieldElementId(
					'desktop_config',
					'wallpapers_history'
				)}
				className="scroll-mt-20"
				aria-hidden
			/>
			<p
				className={cn(
					'mb-2 font-medium text-(--desktop-text-secondary)',
					DESKTOP_TYPOGRAPHY.captionInherit
				)}
			>
				{tSettings('settingsPanel.cardWallpaperTitle')}
			</p>
			<div className="flex min-w-0 flex-wrap items-center gap-3">
				<div data-testid="desktop-settings-wallpaper-thumb">
					<DesktopSettingsWallpaperPreview
						wallpaper={wallpaper}
						fit="cover"
						className={cn(
							'h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-cover bg-center bg-no-repeat',
							getDesktopShellToolbarClusterInsetControlClassName(
								shell.windowStyle
							)
						)}
					/>
				</div>
				<DesktopChromeTooltip
					content={tSettings('settingsPanel.wallpaperChangeButton')}
					placement="top"
					offsetExtra={4}
				>
					<DesktopAppButton
						type="button"
						variant={isPrimaryCta ? 'accent' : 'neutral'}
						data-testid="desktop-settings-wallpaper-primary-cta"
						onClick={() => {
							onOpenWallpaperPicker();
						}}
					>
						<PhotoIcon className="h-4 w-4" />
						{tSettings('settingsPanel.wallpaperChangeButton')}
					</DesktopAppButton>
				</DesktopChromeTooltip>
			</div>
		</div>
	);
};
