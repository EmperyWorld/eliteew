/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell tab body facade: VD + windows primary; apps/menu/sync behind disclosure;
 * expansion (workspaces) follows Everyday IA.
 *
 * Related:
 * - `DesktopSettingsShellTab.tsx`
 * - `documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md`
 */

import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_SETTINGS_SHELL_ANCHORS } from '../../../constants/desktopSettingsShellAnchors';
import { DesktopSettingsMenuModeCard } from '../DesktopSettingsMenuModeCard';
import { DesktopSettingsMotionSection } from '../DesktopSettingsMotionSection';
import { DesktopSettingsPersonalizeDisclosure } from '../personalize/DesktopSettingsPersonalizeDisclosure';
import { DesktopSettingsShellSyncPrefsCard } from '../DesktopSettingsShellSyncPrefsCard';
import { ExpansionSettingsSection } from './DesktopSettingsExpansionSection';
import { DesktopSettingsExpansionShellAppsCard } from './DesktopSettingsExpansionShellAppsCard';
import { DesktopSettingsExpansionShellSyncDataCard } from './DesktopSettingsExpansionShellSyncDataCard';
import { DesktopSettingsExpansionShellVirtualDesktopsCard } from './DesktopSettingsExpansionShellVirtualDesktopsCard';
import { DesktopSettingsExpansionShellWindowsWidgetsSection } from './DesktopSettingsExpansionShellWindowsWidgetsSection';
import type { DesktopSettingsExpansionShellClusterProps } from './desktopSettingsExpansionShellCluster.types';

export const DesktopSettingsExpansionShellCluster: FC<
	DesktopSettingsExpansionShellClusterProps
> = (props) => {
	const { t } = useTranslation('desktopUi');
	const {
		desktopOpenAppsMaximized,
		onDesktopOpenAppsMaximizedChange,
		expansionSettings,
		settingsCenterBridge,
		shell,
		workspaceProfilesShellContext,
		onStorageMapFieldNavigate,
		savedFilterShortcutDraft,
		setSavedFilterShortcutDraft,
	} = props;

	return (
		<>
			<div
				id={DESKTOP_SETTINGS_SHELL_ANCHORS.workspaces}
				className="scroll-mt-20 space-y-5"
			>
				<DesktopSettingsMotionSection>
					<DesktopSettingsExpansionShellVirtualDesktopsCard
						settingsCenterBridge={settingsCenterBridge}
						shell={shell}
					/>
				</DesktopSettingsMotionSection>
			</div>

			<div
				id={DESKTOP_SETTINGS_SHELL_ANCHORS.windows}
				className="scroll-mt-20 space-y-5"
			>
				<DesktopSettingsExpansionShellWindowsWidgetsSection
					desktopOpenAppsMaximized={desktopOpenAppsMaximized}
					onDesktopOpenAppsMaximizedChange={onDesktopOpenAppsMaximizedChange}
					shell={shell}
				/>
			</div>

			<DesktopSettingsPersonalizeDisclosure
				title={t('settingsPanel.shellMoreDesktopOptionsTitle')}
				description={t('settingsPanel.shellMoreDesktopOptionsHint')}
				data-testid="desktop-settings-shell-more-options"
			>
				<div
					id={DESKTOP_SETTINGS_SHELL_ANCHORS.apps}
					className="scroll-mt-20 space-y-5"
				>
					<DesktopSettingsMotionSection delaySec={0}>
						<DesktopSettingsExpansionShellAppsCard
							settingsCenterBridge={settingsCenterBridge}
							shell={shell}
						/>
					</DesktopSettingsMotionSection>
				</div>

				<div
					id={DESKTOP_SETTINGS_SHELL_ANCHORS.menuMode}
					className="scroll-mt-20 space-y-5"
				>
					<DesktopSettingsMotionSection delaySec={0.02}>
						<DesktopSettingsMenuModeCard shell={shell} />
					</DesktopSettingsMotionSection>
				</div>

				<div
					id={DESKTOP_SETTINGS_SHELL_ANCHORS.sync}
					className="scroll-mt-20 space-y-5"
				>
					<DesktopSettingsMotionSection delaySec={0.04}>
						<DesktopSettingsShellSyncPrefsCard
							syncPrefs={settingsCenterBridge.syncPrefs}
							shell={shell}
						/>
					</DesktopSettingsMotionSection>
					<DesktopSettingsMotionSection delaySec={0.06}>
						<DesktopSettingsExpansionShellSyncDataCard
							settingsCenterBridge={settingsCenterBridge}
							expansionSettings={expansionSettings}
							shell={shell}
						/>
					</DesktopSettingsMotionSection>
				</div>
			</DesktopSettingsPersonalizeDisclosure>

			<ExpansionSettingsSection
				anchorId={DESKTOP_SETTINGS_SHELL_ANCHORS.advanced}
				expansionSettings={expansionSettings}
				shell={shell}
				onBringWindowsToWorkArea={
					settingsCenterBridge.windows.onBringWindowsIntoWorkArea
				}
				workspaceProfileEditorContext={{
					virtualDesktops: settingsCenterBridge.virtualDesktops.desktops,
					globalWallpaper: settingsCenterBridge.virtualDesktops.globalWallpaper,
				}}
				workspaceProfilesShellContext={workspaceProfilesShellContext}
				profileAppCatalog={settingsCenterBridge.apps.installedApps}
				savedFilterShortcutDraft={savedFilterShortcutDraft}
				setSavedFilterShortcutDraft={setSavedFilterShortcutDraft}
				onStorageMapFieldNavigate={onStorageMapFieldNavigate}
			/>
		</>
	);
};
