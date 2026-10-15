/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Widget panel chrome style picker (shared window frame presets).
 *
 * Related:
 * - `DesktopSettingsWidgetsTab.tsx`
 */

import { CheckCircleIcon } from '@heroicons/react/24/outline';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { type DesktopWidgetsStyle } from '@/types/profile';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { DESKTOP_WINDOW_FRAME_STYLES } from '../../utils/desktopVisualSystem';
import { buildDesktopSettingsFieldElementId } from '../../utils/desktopSettingsFieldElementIds';
import { DESKTOP_SETTINGS_WIDGETS_ANCHORS } from '../../constants/desktopSettingsWidgetsAnchors';
import type {
	DesktopSettingsShellHelpers,
	DesktopSettingsVisualLabels,
} from './desktopSettingsShared.types';
import { SettingsFormCard } from './DesktopSettingsFormCard';
import { desktopSettingsStylePickerCardClass } from './desktopSettingsSharedUi';
import { DesktopWidgetsStyleMiniPreview } from './desktopSettingsPreviewComponents';

const DESKTOP_WIDGETS_STYLE_PICKER_KEYS = Object.keys(
	DESKTOP_WINDOW_FRAME_STYLES
) as DesktopWidgetsStyle[];

export type DesktopSettingsWidgetsStyleCardProps = {
	desktopWidgetsStyle: DesktopWidgetsStyle;
	onDesktopWidgetsStyleChange: (value: DesktopWidgetsStyle) => void;
	shell: DesktopSettingsShellHelpers;
	visualLabels: DesktopSettingsVisualLabels;
};

export const DesktopSettingsWidgetsStyleCard: FC<
	DesktopSettingsWidgetsStyleCardProps
> = ({
	desktopWidgetsStyle,
	onDesktopWidgetsStyleChange,
	shell,
	visualLabels,
}) => {
	const { t } = useTranslation('desktopUi');

	return (
		<SettingsFormCard
			id={DESKTOP_SETTINGS_WIDGETS_ANCHORS.style}
			title={t('settingsPanel.cardWidgetStyleTitle')}
			windowStyle={shell.windowStyle}
		>
			<div
				id={buildDesktopSettingsFieldElementId(
					'profile_ui',
					'desktop_widgets_style'
				)}
				className="scroll-mt-20"
				aria-hidden
			/>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
				{DESKTOP_WIDGETS_STYLE_PICKER_KEYS.map((style) => {
					const label = visualLabels.windowStyle[style];
					const desc = visualLabels.windowStyleDesc[style];
					return (
						<DesktopChromeTooltip
							key={style}
							content={`${label} — ${desc}`}
							placement="top"
							offsetExtra={4}
						>
							<button
								type="button"
								aria-pressed={desktopWidgetsStyle === style}
								onClick={() => onDesktopWidgetsStyleChange(style)}
								className={desktopSettingsStylePickerCardClass(
									desktopWidgetsStyle === style
								)}
							>
								{desktopWidgetsStyle === style ? (
									<CheckCircleIcon
										className="absolute top-3 right-3 size-4 shrink-0 text-[rgb(var(--desktop-accent-rgb))] drop-shadow-sm"
										aria-hidden
									/>
								) : null}
								<DesktopWidgetsStyleMiniPreview style={style} />
								<span className="text-sm font-medium text-(--desktop-text-primary)">
									{label}
								</span>
								<span className={DESKTOP_TYPOGRAPHY.caption}>{desc}</span>
							</button>
						</DesktopChromeTooltip>
					);
				})}
			</div>
		</SettingsFormCard>
	);
};
