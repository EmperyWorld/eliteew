/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Playbooks workspace: runtime playbook runner and about copy for the active vertical.
 *
 * Related:
 * - ProfessionalPlaybooksRuntimePanel.tsx
 * - runtimeModuleRegistry.tsx (`PlaybooksRegistryPanel`)
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import { useProfessionalWorldsWorkspace } from '../ProfessionalWorldsWorkspaceContext';
import { ProfessionalPlaybooksRuntimePanel } from '../ProfessionalPlaybooksRuntimePanel';
import { ProfessionalWorldsActiveContextStrip } from '../components/ProfessionalWorldsActiveContextStrip';
import type { RuntimeModulePanelProps } from '../runtimeModuleRegistry';
import type { ProfessionalWorldsSnapshot } from '../types';
import {
	ProfessionalWorldsHeroPanel,
	ProfessionalWorldsProgressRail,
	ProfessionalWorldsTrustNote,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSection,
	ProfessionalWorldsWorkspaceSubtabs,
} from '../layout';

function resolveRuntimePlaybooks(
	snapshot: ProfessionalWorldsSnapshot,
	verticalSlug: string
) {
	const fromList = snapshot.runtimeConfigs.find(
		(config) => config.vertical_slug === verticalSlug
	);
	if (fromList?.playbooks) {
		return fromList.playbooks;
	}
	if (snapshot.runtimeConfig?.vertical_slug === verticalSlug) {
		return snapshot.runtimeConfig.playbooks ?? [];
	}
	return [];
}

export function PlaybooksRegistryPanel({
	snapshot,
	verticalSlug,
}: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const playbooks = useMemo(
		() => resolveRuntimePlaybooks(snapshot, verticalSlug),
		[snapshot, verticalSlug]
	);

	return (
		<ProfessionalWorldsWorkspacePanel title={t('playbooksPanel.title')}>
			<p className="mb-3 text-sm text-(--desktop-text-secondary)">
				{t('playbooksPanel.runnerLead')}
			</p>
			<p className="text-xs text-(--desktop-text-secondary)">
				{t('playbooksPanel.subtitle')}
			</p>
			<ProfessionalPlaybooksRuntimePanel
				verticalSlug={verticalSlug}
				playbooks={playbooks}
			/>
		</ProfessionalWorldsWorkspacePanel>
	);
}

export function PlaybooksWorkspacePanel() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { activeRuntimeConfig, activeVerticalSlug, openArtifacts, navigate } =
		useProfessionalWorldsWorkspace();
	const [playbooksWorkspaceTab, setPlaybooksWorkspaceTab] = useState<
		'runner' | 'about'
	>('runner');
	const playbooks = activeRuntimeConfig?.playbooks ?? [];
	const playbookCount = playbooks.length;
	const hasPlaybooks = playbookCount > 0;
	const heroCopy = useMemo(
		() =>
			hasPlaybooks
				? {
						title: t('playbooksPanel.visible.readyTitle'),
						description: t('playbooksPanel.visible.readyDescription'),
					}
				: {
						title: t('playbooksPanel.visible.emptyTitle'),
						description: t('playbooksPanel.visible.emptyDescription'),
					},
		[hasPlaybooks, t]
	);
	const progressItems = useMemo(
		() => [
			{
				id: 'scenarios',
				label: t('playbooksPanel.visible.progressScenarios'),
				value: hasPlaybooks
					? String(playbookCount)
					: t('playbooksPanel.visible.progressTodo'),
				complete: hasPlaybooks,
			},
		],
		[hasPlaybooks, playbookCount, t]
	);
	const heroPrimaryAction = useMemo(() => {
		if (playbooksWorkspaceTab === 'about') {
			return {
				label: t('playbooksPanel.visible.actions.openRunner'),
				onClick: () => setPlaybooksWorkspaceTab('runner'),
			};
		}
		if (!hasPlaybooks) {
			return {
				label: t('playbooksPanel.visible.actions.prepareListing'),
				onClick: () => navigate('properties'),
			};
		}
		return undefined;
	}, [hasPlaybooks, navigate, playbooksWorkspaceTab, t]);
	const heroSecondaryAction =
		playbooksWorkspaceTab === 'runner' && hasPlaybooks ? (
			<DesktopAppButton
				type="button"
				variant="ghost"
				onClick={() => setPlaybooksWorkspaceTab('about')}
			>
				{t('playbooksPanel.visible.actions.openAbout')}
			</DesktopAppButton>
		) : playbooksWorkspaceTab === 'about' ? (
			<DesktopAppButton
				type="button"
				variant="ghost"
				onClick={() => navigate('properties')}
			>
				{t('playbooksPanel.visible.actions.prepareListing')}
			</DesktopAppButton>
		) : undefined;

	return (
		<ProfessionalWorldsWorkspaceSection
			title={t('nav.playbooks')}
			subtabs={
				<ProfessionalWorldsWorkspaceSubtabs
					active={playbooksWorkspaceTab}
					ariaLabel={t('playbooksPanel.workspaceAria')}
					items={[
						{ id: 'runner', label: t('playbooksPanel.tabs.runner') },
						{ id: 'about', label: t('playbooksPanel.tabs.about') },
					]}
					onSelect={(id) => setPlaybooksWorkspaceTab(id as 'runner' | 'about')}
				/>
			}
		>
			<ProfessionalWorldsHeroPanel
				eyebrow={t('playbooksPanel.visible.eyebrow')}
				title={heroCopy.title}
				description={heroCopy.description}
				primaryAction={
					heroPrimaryAction ? (
						<DesktopAppButton type="button" onClick={heroPrimaryAction.onClick}>
							{heroPrimaryAction.label}
						</DesktopAppButton>
					) : undefined
				}
				secondaryAction={heroSecondaryAction}
				meta={
					<ProfessionalWorldsProgressRail
						title={t('overview.visible.progress.title')}
						items={progressItems}
					/>
				}
			/>
			<ProfessionalWorldsTrustNote
				title={t('playbooksPanel.visible.trustTitle')}
			>
				{t('playbooksPanel.visible.trustBody')}
			</ProfessionalWorldsTrustNote>
			{playbooksWorkspaceTab === 'runner' ? (
				<>
					<ProfessionalWorldsActiveContextStrip />
					<ProfessionalWorldsWorkspacePanel title={t('playbooksPanel.title')}>
						<p className="text-xs text-(--desktop-text-secondary)">
							{t('playbooksPanel.subtitle')}
						</p>
						<ProfessionalPlaybooksRuntimePanel
							verticalSlug={activeVerticalSlug}
							playbooks={activeRuntimeConfig?.playbooks ?? []}
						/>
					</ProfessionalWorldsWorkspacePanel>
					<ProfessionalWorldsWorkspacePanel
						title={t('playbooksPanel.afterRun.title')}
						dense
					>
						<p className="text-sm text-(--desktop-text-secondary)">
							{t('playbooksPanel.afterRun.lead')}
						</p>
						<div className="flex flex-wrap gap-2">
							<DesktopAppButton variant="ghost" onClick={() => openArtifacts()}>
								{t('playbooksPanel.afterRun.openResults')}
							</DesktopAppButton>
							<DesktopAppButton
								variant="ghost"
								onClick={() => openArtifacts({ tab: 'handoff' })}
							>
								{t('playbooksPanel.afterRun.openHandoff')}
							</DesktopAppButton>
							<DesktopAppButton
								variant="ghost"
								onClick={() => navigate('properties')}
							>
								{t('playbooksPanel.afterRun.openListings')}
							</DesktopAppButton>
						</div>
					</ProfessionalWorldsWorkspacePanel>
				</>
			) : null}
			{playbooksWorkspaceTab === 'about' ? (
				<ProfessionalWorldsWorkspacePanel
					title={t('playbooksPanel.tabs.about')}
					dense
				>
					<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
						{t('playbooksPanel.aboutBody')}
					</p>
				</ProfessionalWorldsWorkspacePanel>
			) : null}
		</ProfessionalWorldsWorkspaceSection>
	);
}
