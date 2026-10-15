/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Personal brand starters and media-kit link for the active profession vertical.
 *
 * Invariants:
 * - Brand lane text is owned by workspace context AI streams; this panel only seeds templates.
 * - Presentation brief may require a selected listing from the objects workspace.
 *
 * Related:
 * - ProfessionalWorldsWorkspaceContext.tsx
 * - ProfessionalWorldsAiOutputRail.tsx
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { useProfessionalWorldsWorkspace } from '../ProfessionalWorldsWorkspaceContext';
import { shouldShowBrandEwDeskReminder } from '../brandEwDeskReminderLogic';
import {
	ProfessionalWorldsHeroPanel,
	ProfessionalWorldsProgressRail,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTrustNote,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSection,
	ProfessionalWorldsWorkspaceSubtabs,
	pwBrandStartersGridClass,
} from '../layout';

export function BrandWorkspacePanel() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const {
		navigate,
		openArtifacts,
		preparedPresentationBrief,
		selectedProperty,
		setLaneStatus,
		setLaneText,
		brandStream,
		activeRuntimeConfig,
		embeddedMobileLayout,
		snapshot,
	} = useProfessionalWorldsWorkspace();
	const propertyArtifactCount = useMemo(
		() =>
			selectedProperty
				? snapshot.artifacts.filter(
						(artifact) => artifact.source_id === selectedProperty.id
					).length
				: 0,
		[selectedProperty, snapshot.artifacts]
	);
	const showEwDeskReminder = useMemo(
		() =>
			shouldShowBrandEwDeskReminder({
				brandStreamText: brandStream.text,
				brandStreamStatus: brandStream.status,
				integrations: activeRuntimeConfig?.integrations ?? [],
			}),
		[activeRuntimeConfig?.integrations, brandStream.status, brandStream.text]
	);
	const [brandWorkspaceTab, setBrandWorkspaceTab] = useState<
		'starters' | 'mediaKit'
	>('starters');
	const hasBrandOutput = brandStream.text.trim().length > 0;
	const heroCopy = useMemo(
		() =>
			hasBrandOutput
				? {
						title: t('brand.visible.readyTitle'),
						description: t('brand.visible.readyDescription'),
					}
				: {
						title: t('brand.visible.emptyTitle'),
						description: t('brand.visible.emptyDescription'),
					},
		[hasBrandOutput, t]
	);
	const progressItems = useMemo(
		() => [
			{
				id: 'listing',
				label: t('brand.visible.progressListing'),
				value: selectedProperty
					? selectedProperty.title
					: t('brand.visible.progressTodo'),
				complete: Boolean(selectedProperty),
			},
			{
				id: 'output',
				label: t('brand.visible.progressOutput'),
				value: hasBrandOutput
					? t('brand.visible.progressReady')
					: t('brand.visible.progressTodo'),
				complete: hasBrandOutput,
			},
		],
		[hasBrandOutput, selectedProperty, t]
	);
	const heroPrimaryAction = useMemo(() => {
		if (brandWorkspaceTab === 'mediaKit') {
			return {
				label: t('brand.visible.actions.openBrandKit'),
				onClick: () => {
					navigate('properties');
					setLaneStatus('listing', t('brand.openBrandKitHint'));
				},
			};
		}
		if (!selectedProperty) {
			return {
				label: t('brand.visible.actions.openListings'),
				onClick: () => navigate('properties'),
			};
		}
		return {
			label: t('brand.visible.actions.draftWeekPlan'),
			onClick: () => {
				setLaneText('brand', t('brand.weekPlan'));
				setLaneStatus('brand', t('brand.templateInserted'));
			},
		};
	}, [
		brandWorkspaceTab,
		navigate,
		selectedProperty,
		setLaneStatus,
		setLaneText,
		t,
	]);

	return (
		<ProfessionalWorldsWorkspaceSection
			title={t('brand.title')}
			subtabs={
				<ProfessionalWorldsWorkspaceSubtabs
					active={brandWorkspaceTab}
					ariaLabel={t('brand.workspaceAria')}
					items={[
						{ id: 'starters', label: t('brand.tabs.starters') },
						{ id: 'mediaKit', label: t('brand.tabs.mediaKitLink') },
					]}
					onSelect={(id) => setBrandWorkspaceTab(id as 'starters' | 'mediaKit')}
				/>
			}
		>
			<ProfessionalWorldsHeroPanel
				eyebrow={t('brand.visible.eyebrow')}
				title={heroCopy.title}
				description={heroCopy.description}
				primaryAction={
					<DesktopAppButton type="button" onClick={heroPrimaryAction.onClick}>
						{heroPrimaryAction.label}
					</DesktopAppButton>
				}
				meta={
					<ProfessionalWorldsProgressRail
						title={t('overview.visible.progress.title')}
						items={progressItems}
					/>
				}
			/>
			<ProfessionalWorldsTrustNote title={t('brand.visible.trustTitle')}>
				{t('brand.visible.trustBody')}
			</ProfessionalWorldsTrustNote>
			{brandWorkspaceTab === 'starters' ? (
				<ProfessionalWorldsWorkspacePanel>
					{showEwDeskReminder ? (
						<ProfessionalWorldsStatusBanner kind="info">
							<div className="grid gap-2">
								<span>{t('brand.ewDeskReminder.body')}</span>
								<DesktopAppButton
									size="sm"
									variant="ghost"
									onClick={() => openArtifacts({ tab: 'handoff' })}
								>
									{t('brand.ewDeskReminder.openHandoff')}
								</DesktopAppButton>
							</div>
						</ProfessionalWorldsStatusBanner>
					) : null}
					<p className="text-xs text-(--desktop-text-muted)">
						{t('brand.startersLead')}
					</p>
					<p className="text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-muted)">
						{t('brand.outputWhereHint')}
					</p>
					<div className={pwBrandStartersGridClass(embeddedMobileLayout)}>
						<DesktopAppSurface
							variant="soft"
							padding="md"
							className="grid gap-2"
						>
							<span className="text-sm font-semibold text-(--desktop-text-primary)">
								{t('brand.cardWeekTitle')}
							</span>
							<p className="text-xs text-(--desktop-text-secondary)">
								{t('brand.cardWeekBody')}
							</p>
							<DesktopAppButton
								className="mt-auto justify-self-start"
								onClick={() => {
									setLaneText('brand', t('brand.weekPlan'));
									setLaneStatus('brand', t('brand.templateInserted'));
								}}
							>
								{t('brand.weekPlanAction')}
							</DesktopAppButton>
						</DesktopAppSurface>
						<DesktopAppSurface
							variant="soft"
							padding="md"
							className="grid gap-2"
						>
							<span className="text-sm font-semibold text-(--desktop-text-primary)">
								{t('brand.cardPresentationTitle')}
							</span>
							<p className="text-xs text-(--desktop-text-secondary)">
								{t('brand.cardPresentationBody')}
							</p>
							<DesktopAppButton
								className="mt-auto justify-self-start"
								onClick={() => {
									const brief = preparedPresentationBrief.trim();
									setLaneText(
										'brand',
										brief || t('brand.presentationNeedsListing')
									);
									setLaneStatus(
										'brand',
										brief
											? t('brand.templateInserted')
											: t('brand.presentationPlaceholderUsed')
									);
								}}
							>
								{t('brand.presentationBrief')}
							</DesktopAppButton>
						</DesktopAppSurface>
						<DesktopAppSurface
							variant="soft"
							padding="md"
							className="grid gap-2"
						>
							<span className="text-sm font-semibold text-(--desktop-text-primary)">
								{t('brand.cardSiteTitle')}
							</span>
							<p className="text-xs text-(--desktop-text-secondary)">
								{t('brand.cardSiteBody')}
							</p>
							<DesktopAppButton
								className="mt-auto justify-self-start"
								onClick={() => {
									setLaneText('brand', t('brand.siteStudioBrief'));
									setLaneStatus('brand', t('brand.templateInserted'));
								}}
							>
								{t('brand.siteStudioBriefAction')}
							</DesktopAppButton>
						</DesktopAppSurface>
					</div>
				</ProfessionalWorldsWorkspacePanel>
			) : null}
			{brandWorkspaceTab === 'mediaKit' ? (
				<ProfessionalWorldsWorkspacePanel title={t('brand.tabs.mediaKitLink')}>
					<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
						{t('brand.mediaKitTabBody')}
					</p>
					{selectedProperty ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('brand.mediaKitSelectedListing', {
								title: selectedProperty.title,
							})}
						</p>
					) : (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('brand.mediaKitNoListing')}
						</p>
					)}
					<p className="text-xs text-(--desktop-text-muted)">
						{t('brand.openBrandKitHint')}
					</p>
					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							variant="ghost"
							onClick={() => {
								navigate('properties');
								setLaneStatus('listing', t('brand.openBrandKitHint'));
							}}
						>
							{t('brand.openBrandKitWorkbench')}
						</DesktopAppButton>
						{propertyArtifactCount > 0 ? (
							<DesktopAppButton
								variant="ghost"
								onClick={() => openArtifacts({ tab: 'handoff' })}
							>
								{t('brand.mediaKitOpenHandoff')}
							</DesktopAppButton>
						) : null}
					</div>
				</ProfessionalWorldsWorkspacePanel>
			) : null}
		</ProfessionalWorldsWorkspaceSection>
	);
}
