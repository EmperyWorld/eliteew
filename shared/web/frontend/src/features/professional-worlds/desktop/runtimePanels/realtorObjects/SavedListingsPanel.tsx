/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Saved listings grid with cover cards and delete actions.
 *
 * Invariants:
 * - Extract-only split from legacy RealtorObjectsWorkspacePanel; behavior unchanged.
 *
 * Related:
 * - RealtorObjectsWorkspaceShell.tsx
 */

import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { PropertySavedListingCard } from '../../components/PropertySavedListingCard';
import { ProfessionalWorldsWorkspacePanel } from '../../layout';

import { useRealtorObjectsPanelVm } from './panelVm';

export function SavedListingsPanel() {
	const vm = useRealtorObjectsPanelVm();
	return (
		<>
			{vm.snapshot.properties.length > 0 ? (
				<p className="text-xs text-(--desktop-text-muted)">
					{vm.t('properties.savedListingsSummary', {
						count: vm.snapshot.properties.length,
					})}
				</p>
			) : null}
			<ProfessionalWorldsWorkspacePanel title={vm.t('properties.current')}>
				<p className="text-xs text-(--desktop-text-muted)">
					{vm.t('properties.savedListingsHint')}
				</p>
				{vm.snapshot.properties.length === 0 ? (
					<DesktopAppEmptyState
						title={vm.t('properties.emptyTitle')}
						description={vm.t('properties.emptyBody')}
					>
						<DesktopAppButton
							onClick={() => vm.setPropertiesWorkspaceTab('newDraft')}
						>
							{vm.t('properties.emptyCreateCta')}
						</DesktopAppButton>
					</DesktopAppEmptyState>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
						{vm.snapshot.properties.map((property) => (
							<div className="grid gap-2" key={property.id}>
								<PropertySavedListingCard
									coverEntry={vm.listingCoverStatesByPropertyId[property.id]}
									listingCoverMediaRevision={vm.listingMediaRefreshAt ?? 0}
									property={property}
									registerListingCoverInterest={vm.registerListingCoverInterest}
									selected={vm.selectedPropertyId === property.id}
									t={vm.t}
									onSelect={() => {
										vm.setSelectedPropertyId(property.id);
										vm.setPropertiesWorkspaceTab('listingWorkspace');
									}}
								/>
								<DesktopAppButton
									size="sm"
									variant="ghost"
									className="justify-self-start"
									onClick={() =>
										vm.setPropertyDeleteTarget({
											id: property.id,
											title: property.title,
										})
									}
								>
									{vm.t('properties.deleteAction')}
								</DesktopAppButton>
							</div>
						))}
					</div>
				)}
				{vm.snapshot.properties.length > 0 && !vm.selectedProperty ? (
					<DesktopAppEmptyState
						title={vm.t('properties.selectListingTitle')}
						description={vm.t('properties.selectListingBody')}
					/>
				) : null}
			</ProfessionalWorldsWorkspacePanel>
		</>
	);
}
