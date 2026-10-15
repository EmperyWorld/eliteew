/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Advanced expansion settings orchestrator: lazy-loaded cards under shell tab anchor.
 *
 * Invariants:
 * - Workspace profiles stay primary; discovery / assistant sit behind
 *   «More desktop options»; storage map remains last under «For support».
 * - Card modules live alongside this file; each loads via `React.lazy`.
 *
 * Related:
 * - `DesktopSettingsExpansionShellCluster.tsx`, `useDesktopExpansionSettings.ts`
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md
 */

import { lazy, Suspense, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_INTERACTIVE } from '../../../constants';
import { DesktopSettingsMotionSection } from '../DesktopSettingsMotionSection';
import { ExpansionCardSkeleton } from '../desktopSettingsSharedUi';
import type { ExpansionSettingsSectionProps } from './desktopSettingsExpansionSection.types';

export type { ExpansionSettingsSectionProps } from './desktopSettingsExpansionSection.types';

const DesktopSettingsExpansionStorageCardLazy = lazy(async () => {
	const mod = await import('./DesktopSettingsExpansionStorageCard');
	return { default: mod.DesktopSettingsExpansionStorageCard };
});
const DesktopSettingsExpansionWorkspaceCardLazy = lazy(async () => {
	const mod = await import('./DesktopSettingsExpansionWorkspaceCard');
	return { default: mod.DesktopSettingsExpansionWorkspaceCard };
});
const DesktopSettingsExpansionDiscoveryCardLazy = lazy(async () => {
	const mod = await import('./DesktopSettingsExpansionDiscoveryCard');
	return { default: mod.DesktopSettingsExpansionDiscoveryCard };
});
const DesktopSettingsExpansionAssistantCardLazy = lazy(async () => {
	const mod = await import('./DesktopSettingsExpansionAssistantCard');
	return { default: mod.DesktopSettingsExpansionAssistantCard };
});

const ExpansionCardFallback: FC = () => <ExpansionCardSkeleton />;

export const ExpansionSettingsSection: FC<ExpansionSettingsSectionProps> = (
	props
) => {
	const { t } = useTranslation('desktopUi');
	const {
		anchorId,
		expansionSettings,
		shell,
		onBringWindowsToWorkArea,
		workspaceProfileEditorContext,
		workspaceProfilesShellContext,
		profileAppCatalog,
		savedFilterShortcutDraft,
		setSavedFilterShortcutDraft,
		onStorageMapFieldNavigate,
	} = props;

	return (
		<div id={anchorId} className="scroll-mt-20 space-y-5">
			<h3 id={`${anchorId}-heading`} className="sr-only">
				{t('settingsPanel.expansionSectionTitle')}
			</h3>
			<DesktopSettingsMotionSection delaySec={0.28}>
				<Suspense fallback={<ExpansionCardFallback />}>
					<DesktopSettingsExpansionWorkspaceCardLazy
						expansionSettings={expansionSettings}
						shell={shell}
						onBringWindowsToWorkArea={onBringWindowsToWorkArea}
						workspaceProfileEditorContext={workspaceProfileEditorContext}
						workspaceProfilesShellContext={workspaceProfilesShellContext}
						profileAppCatalog={profileAppCatalog}
					/>
				</Suspense>
			</DesktopSettingsMotionSection>
			{/* Secondary Advanced cards — discovery + Assistant/GAF context */}
			<details
				className="group rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40"
				data-testid="desktop-settings-power-options"
			>
				<summary
					className={cn(
						'cursor-pointer list-none px-4 py-3 text-sm font-semibold text-(--desktop-text-primary) marker:content-none',
						DESKTOP_INTERACTIVE.focusRing
					)}
				>
					<span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
						<span>{t('settingsPanel.powerOptionsTitle')}</span>
						<span className="text-xs font-normal text-(--desktop-text-dim)">
							{t('settingsPanel.powerOptionsHint')}
						</span>
					</span>
				</summary>
				<div className="space-y-5 border-t border-(--desktop-border-subtle) p-3 pt-4">
					<DesktopSettingsMotionSection delaySec={0}>
						<Suspense fallback={<ExpansionCardFallback />}>
							<DesktopSettingsExpansionDiscoveryCardLazy
								expansionSettings={expansionSettings}
								shell={shell}
								savedFilterShortcutDraft={savedFilterShortcutDraft}
								setSavedFilterShortcutDraft={setSavedFilterShortcutDraft}
							/>
						</Suspense>
					</DesktopSettingsMotionSection>
					<DesktopSettingsMotionSection delaySec={0.04}>
						<Suspense fallback={<ExpansionCardFallback />}>
							<DesktopSettingsExpansionAssistantCardLazy
								expansionSettings={expansionSettings}
								shell={shell}
							/>
						</Suspense>
					</DesktopSettingsMotionSection>
				</div>
			</details>
			{/* Support diagnostics last — storage map is not everyday Advanced UX */}
			<DesktopSettingsMotionSection delaySec={0.44}>
				<Suspense fallback={<ExpansionCardFallback />}>
					<DesktopSettingsExpansionStorageCardLazy
						expansionSettings={expansionSettings}
						shell={shell}
						onStorageMapFieldNavigate={onStorageMapFieldNavigate}
					/>
				</Suspense>
			</DesktopSettingsMotionSection>
		</div>
	);
};
