/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Listing AI generation tone and quick cross-module actions.
 *
 * Invariants:
 * - Extract-only split from legacy RealtorObjectsWorkspacePanel; behavior unchanged.
 *
 * Related:
 * - RealtorObjectsWorkspaceShell.tsx
 */

import {
	DesktopAppButton,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { ListingWorkspaceHeaderThumb } from '../../components/PropertySavedListingCard';
import { SupportDetailsPanel } from '../../components/SupportDetailsPanel';
import { ProfessionalWorldsWorkspacePanel } from '../../layout';
import { REALTOR_TONES, buildJtbdPreview } from '../../realtorLogic';
import type { RealtorGenerationTone } from '../../types';

import { useRealtorObjectsPanelVm } from './panelVm';

export function ListingWorkspaceAiPanel() {
	const vm = useRealtorObjectsPanelVm();
	const selectedProperty = vm.selectedProperty;
	if (!selectedProperty) {
		return null;
	}
	const listingCommunicationFocus =
		vm.selectedListingCommunicationFocus ?? undefined;
	return (
		<ProfessionalWorldsWorkspacePanel
			title={vm.t('properties.listingWorkspaceAi')}
		>
			<div className="flex gap-3">
				<ListingWorkspaceHeaderThumb
					coversPending={vm.workspaceListingThumbPending}
					primaryUnifiedContentId={(() => {
						const thumbEntry =
							vm.listingCoverStatesByPropertyId[selectedProperty.id];
						return thumbEntry?.kind === 'ready'
							? (thumbEntry.primaryUnifiedContentId ?? null)
							: null;
					})()}
					title={selectedProperty.title}
					t={vm.t}
				/>
				<p className="min-w-0 flex-1 text-sm text-(--desktop-text-secondary)">
					<strong className="mb-1 block text-(--desktop-text-primary)">
						{selectedProperty.title}
					</strong>
					<span className="block leading-relaxed">
						{buildJtbdPreview(selectedProperty)}
					</span>
					<span className="mt-2 block text-xs text-(--desktop-text-muted)">
						{vm.t('properties.listingWorkspaceHint')}
					</span>
				</p>
			</div>
			<div className="grid gap-2 md:grid-cols-[12rem_1fr] md:items-end">
				<DesktopNativeSelect
					value={vm.tone}
					onChange={(event) =>
						vm.setTone(event.target.value as RealtorGenerationTone)
					}
				>
					{REALTOR_TONES.map((item) => (
						<option key={item.id} value={item.id}>
							{vm.t(item.labelKey)}
						</option>
					))}
				</DesktopNativeSelect>
				<div className="grid gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<DesktopAppButton
							onClick={() => void vm.handleStream('description')}
						>
							{vm.t('ai.description')}
						</DesktopAppButton>
						<DesktopAppButton
							onClick={() => void vm.handleStream('contentPack')}
						>
							{vm.t('ai.contentPack')}
						</DesktopAppButton>
					</div>
					<SupportDetailsPanel summary={vm.t('properties.moreListingActions')}>
						<div className="flex flex-wrap gap-2 pt-1">
							{vm.communicationsModuleEnabled && listingCommunicationFocus ? (
								<DesktopAppButton
									variant="ghost"
									onClick={() =>
										vm.openCommunications(listingCommunicationFocus)
									}
								>
									{vm.t('realtorPro.communications.logCta')}
								</DesktopAppButton>
							) : null}
							<DesktopAppButton
								variant="ghost"
								onClick={() =>
									vm.openClients({
										tab: 'capture',
										linkedPropertyId: selectedProperty.id,
									})
								}
							>
								{vm.t('actions.createDeal')}
							</DesktopAppButton>
							{vm.showingsModuleEnabled ? (
								<DesktopAppButton
									variant="ghost"
									onClick={() => vm.openProfessionTool('realtor_showings')}
								>
									{vm.t('realtorPro.showings.title')}
								</DesktopAppButton>
							) : null}
							{vm.documentsModuleEnabled ? (
								<DesktopAppButton
									variant="ghost"
									onClick={() => vm.openProfessionTool('realtor_documents')}
								>
									{vm.t('realtorPro.documents.title')}
								</DesktopAppButton>
							) : null}
							{vm.marketingModuleEnabled ? (
								<DesktopAppButton
									variant="ghost"
									onClick={() => vm.openProfessionTool('realtor_marketing')}
								>
									{vm.t('realtorPro.marketing.title')}
								</DesktopAppButton>
							) : null}
							{vm.insightsModuleEnabled ? (
								<DesktopAppButton
									variant="ghost"
									onClick={() => vm.openProfessionTool('realtor_insights')}
								>
									{vm.t('realtorPro.insights.title')}
								</DesktopAppButton>
							) : null}
							<DesktopAppButton
								variant="ghost"
								onClick={() =>
									vm.setPropertyDeleteTarget({
										id: selectedProperty.id,
										title: selectedProperty.title,
									})
								}
							>
								{vm.t('properties.deleteAction')}
							</DesktopAppButton>
						</div>
					</SupportDetailsPanel>
				</div>
			</div>
		</ProfessionalWorldsWorkspacePanel>
	);
}
