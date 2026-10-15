/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Default window behavior card in shell tab (new apps maximized).
 *
 * Related:
 * - `DesktopSettingsExpansionShellCluster.tsx`
 */

import { cn } from '@/utils/cn';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../../constants';
import { buildDesktopSettingsFieldElementId } from '../../../utils/desktopSettingsFieldElementIds';
import { SettingsFormCard } from '../DesktopSettingsFormCard';
import { DesktopSettingsMotionSection } from '../DesktopSettingsMotionSection';
import type { DesktopSettingsShellHelpers } from '../desktopSettingsShared.types';

export type DesktopSettingsExpansionShellWindowsWidgetsSectionProps = {
	desktopOpenAppsMaximized: boolean;
	onDesktopOpenAppsMaximizedChange: (value: boolean) => void;
	shell: DesktopSettingsShellHelpers;
};

export const DesktopSettingsExpansionShellWindowsWidgetsSection: FC<
	DesktopSettingsExpansionShellWindowsWidgetsSectionProps
> = ({ desktopOpenAppsMaximized, onDesktopOpenAppsMaximizedChange, shell }) => {
	const { t } = useTranslation('desktopUi');

	return (
		<DesktopSettingsMotionSection>
			<SettingsFormCard
				id={buildDesktopSettingsFieldElementId(
					'profile_ui',
					'desktop_open_apps_maximized'
				)}
				title={t('settingsPanel.cardNewWindowsTitle')}
				windowStyle={shell.windowStyle}
			>
				<label className="inline-flex cursor-pointer items-center gap-2 text-sm text-(--desktop-text-secondary)">
					<input
						type="checkbox"
						className={shell.checkboxClass}
						checked={desktopOpenAppsMaximized}
						onChange={(event) =>
							onDesktopOpenAppsMaximizedChange(event.target.checked)
						}
					/>
					{t('settingsPanel.openNewAppsMaximized')}
				</label>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.captionInherit,
						'mt-2 text-(--desktop-text-dim)'
					)}
				>
					{t('settingsPanel.openNewAppsMaximizedHint')}
				</p>
			</SettingsFormCard>
		</DesktopSettingsMotionSection>
	);
};
