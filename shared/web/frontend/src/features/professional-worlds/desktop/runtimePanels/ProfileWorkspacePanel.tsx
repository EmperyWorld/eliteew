/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Specialist profile editor for the active profession vertical (presence + positioning).
 *
 * Invariants:
 * - Parent owns `profileDraft` and persists via `PUT /professional-worlds/me/profile`.
 * - `vertical_slug` on draft must match the toolbar-selected profession.
 *
 * Related:
 * - profileDraftDefaults.ts
 * - layout/ProfessionalWorldsWorkspaceSection.tsx
 */

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppInput,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { ProfilePublicPresenceWizard } from '../components/ProfilePublicPresenceWizard';
import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsHeroPanel,
	ProfessionalWorldsOutcomeCard,
	ProfessionalWorldsProgressRail,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTrustNote,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSection,
	ProfessionalWorldsWorkspaceSubtabs,
	pwFormGridClass,
} from '../layout';
import {
	countProfileBasicsProgress,
	isProfilePublicPresenceReady,
} from '../profilePublicPresenceLogic';
import { useProfessionalWorldsWorkspace } from '../ProfessionalWorldsWorkspaceContext';
import type { SpecialistProfileUpsert } from '../types';

export type ProfileWorkspacePanelProps = {
	profileDraft: SpecialistProfileUpsert;
	setProfileDraft: Dispatch<SetStateAction<SpecialistProfileUpsert>>;
	profileBanner: { kind: 'success' | 'error'; text: string } | null;
	saving: boolean;
	onSaveProfile: () => void | Promise<void>;
};

export function ProfileWorkspacePanel({
	profileDraft,
	setProfileDraft,
	profileBanner,
	saving,
	onSaveProfile,
}: ProfileWorkspacePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { embeddedMobileLayout } = useProfessionalWorldsWorkspace();
	const [profileWorkspaceTab, setProfileWorkspaceTab] = useState<
		'presence' | 'positioning' | 'publicPresence'
	>('presence');
	const basicsProgress = useMemo(
		() => countProfileBasicsProgress(profileDraft),
		[profileDraft]
	);
	const profileBasicsReady = basicsProgress.filled === basicsProgress.total;
	const publicPresenceReady = isProfilePublicPresenceReady(profileDraft);
	const profileProgressItems = useMemo(
		() => [
			{
				id: 'basics',
				label: t('profile.visible.progressBasics'),
				value: `${basicsProgress.filled}/${basicsProgress.total}`,
				complete: profileBasicsReady,
			},
			{
				id: 'public',
				label: t('profile.visible.progressPublic'),
				value: publicPresenceReady
					? t('profile.visible.progressReady')
					: t('profile.visible.progressTodo'),
				complete: publicPresenceReady,
			},
		],
		[
			basicsProgress.filled,
			basicsProgress.total,
			profileBasicsReady,
			publicPresenceReady,
			t,
		]
	);
	const heroPrimaryAction = useMemo(() => {
		if (profileWorkspaceTab === 'publicPresence') {
			if (!publicPresenceReady) {
				return {
					label: t('profile.goToBasics'),
					onClick: () => setProfileWorkspaceTab('presence'),
				};
			}
			return undefined;
		}
		return {
			label: saving ? t('profile.saving') : t('actions.saveProfile'),
			onClick: () => void onSaveProfile(),
			disabled: saving,
		};
	}, [onSaveProfile, profileWorkspaceTab, publicPresenceReady, saving, t]);
	const heroSecondaryAction =
		profileWorkspaceTab !== 'publicPresence' && profileBasicsReady ? (
			<DesktopAppButton
				type="button"
				variant="ghost"
				onClick={() => setProfileWorkspaceTab('publicPresence')}
			>
				{t('profile.outcomePublicPresence')}
			</DesktopAppButton>
		) : undefined;

	return (
		<ProfessionalWorldsWorkspaceSection
			title={t('profile.title')}
			subtabs={
				<ProfessionalWorldsWorkspaceSubtabs
					active={profileWorkspaceTab}
					ariaLabel={t('profile.workspaceAria')}
					items={[
						{ id: 'presence', label: t('profile.tabs.presence') },
						{ id: 'positioning', label: t('profile.tabs.positioning') },
						{
							id: 'publicPresence',
							label: t('profile.tabs.publicPresence'),
						},
					]}
					onSelect={(id) =>
						setProfileWorkspaceTab(
							id as 'presence' | 'positioning' | 'publicPresence'
						)
					}
				/>
			}
		>
			<ProfessionalWorldsHeroPanel
				eyebrow={t('profile.visible.eyebrow')}
				title={
					profileBasicsReady
						? t('profile.visible.readyTitle')
						: t('profile.visible.incompleteTitle')
				}
				description={
					profileBasicsReady
						? t('profile.visible.readyDescription')
						: t('profile.visible.incompleteDescription')
				}
				primaryAction={
					heroPrimaryAction ? (
						<DesktopAppButton
							type="button"
							disabled={heroPrimaryAction.disabled}
							onClick={heroPrimaryAction.onClick}
						>
							{heroPrimaryAction.label}
						</DesktopAppButton>
					) : undefined
				}
				secondaryAction={heroSecondaryAction}
				meta={
					<ProfessionalWorldsProgressRail
						title={t('overview.visible.progress.title')}
						items={profileProgressItems}
					/>
				}
			/>
			<ProfessionalWorldsTrustNote title={t('profile.visible.trustTitle')}>
				{t('profile.visible.trustBody')}
			</ProfessionalWorldsTrustNote>
			<ProfessionalWorldsWorkspacePanel>
				{profileWorkspaceTab !== 'publicPresence' ? (
					<p className="text-xs text-(--desktop-text-secondary)">
						{t('profile.completionHint', {
							filled: basicsProgress.filled,
							total: basicsProgress.total,
						})}
					</p>
				) : null}
				{profileWorkspaceTab === 'publicPresence' ? (
					<ProfilePublicPresenceWizard
						profileDraft={profileDraft}
						onGoToBasics={() => setProfileWorkspaceTab('presence')}
					/>
				) : null}
				{profileWorkspaceTab === 'presence' ? (
					<>
						<p className="text-xs text-(--desktop-text-secondary)">
							{t('profile.presenceLead')}
						</p>
						<div className={pwFormGridClass(embeddedMobileLayout)}>
							<ProfessionalWorldsFormField label={t('profile.name')}>
								<DesktopAppInput
									value={profileDraft.display_name ?? ''}
									placeholder={t('profile.namePlaceholder')}
									onChange={(event) =>
										setProfileDraft((current) => ({
											...current,
											display_name: event.target.value,
										}))
									}
								/>
							</ProfessionalWorldsFormField>
							<ProfessionalWorldsFormField label={t('profile.city')}>
								<DesktopAppInput
									value={profileDraft.city ?? ''}
									placeholder={t('profile.cityPlaceholder')}
									onChange={(event) =>
										setProfileDraft((current) => ({
											...current,
											city: event.target.value,
										}))
									}
								/>
							</ProfessionalWorldsFormField>
						</div>
					</>
				) : null}
				{profileWorkspaceTab === 'positioning' ? (
					<>
						<p className="text-xs text-(--desktop-text-secondary)">
							{t('profile.positioningLead')}
						</p>
						<div className={pwFormGridClass(embeddedMobileLayout)}>
							<ProfessionalWorldsFormField label={t('profile.headline')}>
								<DesktopAppInput
									value={profileDraft.headline ?? ''}
									placeholder={t('profile.headlinePlaceholder')}
									onChange={(event) =>
										setProfileDraft((current) => ({
											...current,
											headline: event.target.value,
										}))
									}
								/>
							</ProfessionalWorldsFormField>
							<ProfessionalWorldsFormField label={t('profile.agency')}>
								<DesktopAppInput
									value={profileDraft.agency_name ?? ''}
									placeholder={t('profile.agencyPlaceholder')}
									onChange={(event) =>
										setProfileDraft((current) => ({
											...current,
											agency_name: event.target.value,
										}))
									}
								/>
							</ProfessionalWorldsFormField>
						</div>
					</>
				) : null}
				{profileBanner?.kind === 'success' ? (
					<ProfessionalWorldsOutcomeCard
						title={t('profile.outcomeTitle')}
						description={t('profile.outcomeDescription')}
						actions={
							<DesktopAppButton
								type="button"
								variant="ghost"
								onClick={() => setProfileWorkspaceTab('publicPresence')}
							>
								{t('profile.outcomePublicPresence')}
							</DesktopAppButton>
						}
					/>
				) : profileBanner ? (
					<ProfessionalWorldsStatusBanner kind={profileBanner.kind}>
						{profileBanner.text}
					</ProfessionalWorldsStatusBanner>
				) : null}
			</ProfessionalWorldsWorkspacePanel>
		</ProfessionalWorldsWorkspaceSection>
	);
}
