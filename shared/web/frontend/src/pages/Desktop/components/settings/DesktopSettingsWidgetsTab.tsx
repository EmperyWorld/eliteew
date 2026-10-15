/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Widgets tab — floating card, panel layout, and chrome style.
 *
 * Related:
 * - `DesktopSettingsPanelTabPanels.tsx`
 * - `documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md`
 */

import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense } from 'react';
import { type DesktopWidgetsStyle } from '@/types/profile';
import type { WidgetsPanelPosition } from '../../types/desktop.types';
import type { DesktopExpansionSettings } from '../../types/desktopExpansion.types';
import type { DesktopSettingsCenterBridge } from '../../types/desktopSettingsCenterBridge.types';
import { DESKTOP_SETTINGS_WIDGETS_ANCHORS } from '../../constants/desktopSettingsWidgetsAnchors';
import { DesktopSettingsMotionSection } from './DesktopSettingsMotionSection';
import { ExpansionCardSkeleton } from './desktopSettingsSharedUi';
import type {
	DesktopSettingsShellHelpers,
	DesktopSettingsVisualLabels,
} from './desktopSettingsShared.types';
import { DesktopSettingsWidgetsFloatingCard } from './DesktopSettingsWidgetsFloatingCard';
import { DesktopSettingsWidgetsStyleCard } from './DesktopSettingsWidgetsStyleCard';

const DesktopSettingsExpansionWidgetPanelCardLazy = lazy(async () => {
	const mod = await import(
		'./expansion/DesktopSettingsExpansionWidgetPanelCard'
	);
	return { default: mod.DesktopSettingsExpansionWidgetPanelCard };
});

export type DesktopSettingsWidgetsTabProps = {
	desktopFloatingWidgetVisible: boolean;
	onDesktopFloatingWidgetVisibleChange: (value: boolean) => void;
	desktopWidgetsStyle: DesktopWidgetsStyle;
	onDesktopWidgetsStyleChange: (value: DesktopWidgetsStyle) => void;
	showWidgetsPanel: boolean;
	onShowWidgetsPanelChange: (value: boolean) => void;
	widgetsPanelPosition: WidgetsPanelPosition;
	onWidgetsPanelPositionChange: (value: WidgetsPanelPosition) => void;
	compactWidgets: boolean;
	onCompactWidgetsChange: (value: boolean) => void;
	expansionSettings: DesktopExpansionSettings;
	settingsCenterBridge: DesktopSettingsCenterBridge;
	shell: DesktopSettingsShellHelpers;
	visualLabels: DesktopSettingsVisualLabels;
};

export const DesktopSettingsWidgetsTab: FC<DesktopSettingsWidgetsTabProps> = ({
	desktopFloatingWidgetVisible,
	onDesktopFloatingWidgetVisibleChange,
	desktopWidgetsStyle,
	onDesktopWidgetsStyleChange,
	showWidgetsPanel,
	onShowWidgetsPanelChange,
	widgetsPanelPosition,
	onWidgetsPanelPositionChange,
	compactWidgets,
	onCompactWidgetsChange,
	expansionSettings,
	settingsCenterBridge,
	shell,
	visualLabels,
}) => {
	const { t } = useTranslation('desktopUi');

	return (
		<section
			aria-labelledby="widgets-heading"
			className="space-y-5"
			data-testid="desktop-settings-widgets-tab"
		>
			<h3 id="widgets-heading" className="sr-only">
				{t('settingsPanel.sectionWidgetsTitle')}
			</h3>

			<DesktopSettingsMotionSection>
				<DesktopSettingsWidgetsFloatingCard
					desktopFloatingWidgetVisible={desktopFloatingWidgetVisible}
					onDesktopFloatingWidgetVisibleChange={
						onDesktopFloatingWidgetVisibleChange
					}
					syncPrefs={settingsCenterBridge.syncPrefs}
					shell={shell}
				/>
			</DesktopSettingsMotionSection>

			<DesktopSettingsMotionSection delaySec={0.04}>
				<Suspense fallback={<ExpansionCardSkeleton />}>
					<div
						id={DESKTOP_SETTINGS_WIDGETS_ANCHORS.panel}
						className="scroll-mt-20"
					>
						<DesktopSettingsExpansionWidgetPanelCardLazy
							expansionSettings={expansionSettings}
							shell={shell}
							showWidgetsPanel={showWidgetsPanel}
							onShowWidgetsPanelChange={onShowWidgetsPanelChange}
							widgetsPanelPosition={widgetsPanelPosition}
							onWidgetsPanelPositionChange={onWidgetsPanelPositionChange}
							compactWidgets={compactWidgets}
							onCompactWidgetsChange={onCompactWidgetsChange}
						/>
					</div>
				</Suspense>
			</DesktopSettingsMotionSection>

			<DesktopSettingsMotionSection delaySec={0.08}>
				<DesktopSettingsWidgetsStyleCard
					desktopWidgetsStyle={desktopWidgetsStyle}
					onDesktopWidgetsStyleChange={onDesktopWidgetsStyleChange}
					shell={shell}
					visualLabels={visualLabels}
				/>
			</DesktopSettingsMotionSection>
		</section>
	);
};
