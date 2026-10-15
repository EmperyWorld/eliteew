/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile tab wizard guiding the specialist from profile fields to Site Studio preview.
 *
 * Related:
 * - profilePublicPresenceLogic.ts
 * - openProfilePublicPresencePreview.ts
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import {
	buildProfilePublicPresenceCapsule,
	isProfilePublicPresenceReady,
	isProfilePublicPresenceStepDone,
	PROFILE_PUBLIC_PRESENCE_CHECKLIST,
} from '../profilePublicPresenceLogic';
import { openProfilePublicPresencePreview } from '../openProfilePublicPresencePreview';
import { useProfessionalToasts } from '../ProfessionalToast';
import {
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsWorkspacePanel,
} from '../layout';
import type { SpecialistProfileUpsert } from '../types';

export function ProfilePublicPresenceWizard({
	profileDraft,
	onGoToBasics,
}: {
	profileDraft: SpecialistProfileUpsert;
	onGoToBasics?: () => void;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const ready = isProfilePublicPresenceReady(profileDraft);
	const [previewOpened, setPreviewOpened] = useState(false);

	const handleOpenPreview = () => {
		if (!ready) return;
		const opened = openProfilePublicPresencePreview(
			buildProfilePublicPresenceCapsule(profileDraft)
		);
		if (opened) {
			setPreviewOpened(true);
			notifySuccess(t('profile.publicPresence.openedSiteStudio'));
			return;
		}
		notifyApiError(
			new Error(t('profile.publicPresence.openFailed')),
			t,
			t('profile.publicPresence.openFailed')
		);
	};

	return (
		<ProfessionalWorldsWorkspacePanel title={t('profile.publicPresence.title')}>
			<p className="text-xs text-(--desktop-text-secondary)">
				{t('profile.publicPresence.lead')}
			</p>
			<ol
				aria-label={t('profile.publicPresence.checklistAria')}
				className="grid gap-2 text-sm"
			>
				{PROFILE_PUBLIC_PRESENCE_CHECKLIST.map((step) => {
					const done = isProfilePublicPresenceStepDone(step, profileDraft);
					return (
						<li
							key={step}
							className={
								done
									? 'text-(--desktop-text-primary)'
									: 'text-(--desktop-text-muted)'
							}
						>
							<span aria-hidden className="mr-2 font-semibold">
								{done ? '✓' : '○'}
							</span>
							{t(`profile.publicPresence.steps.${step}`, {
								name: profileDraft.display_name ?? '',
								city: profileDraft.city ?? '',
							})}
						</li>
					);
				})}
			</ol>
			{ready ? (
				<ProfessionalWorldsStatusBanner kind="success">
					{t('profile.publicPresence.readyHint')}
				</ProfessionalWorldsStatusBanner>
			) : (
				<ProfessionalWorldsStatusBanner kind="info">
					{t('profile.publicPresence.incompleteHint')}
				</ProfessionalWorldsStatusBanner>
			)}
			{previewOpened ? (
				<ProfessionalWorldsStatusBanner kind="info" role="status">
					{t('profile.publicPresence.afterOpenHint')}
				</ProfessionalWorldsStatusBanner>
			) : null}
			<div className="flex flex-wrap gap-2">
				<DesktopAppButton disabled={!ready} onClick={handleOpenPreview}>
					{t('profile.publicPresence.openPreview')}
				</DesktopAppButton>
				{!ready && onGoToBasics ? (
					<DesktopAppButton variant="ghost" onClick={onGoToBasics}>
						{t('profile.goToBasics')}
					</DesktopAppButton>
				) : null}
			</div>
		</ProfessionalWorldsWorkspacePanel>
	);
}
