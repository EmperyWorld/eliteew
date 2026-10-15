/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Active listing context strip and inline edit fields.
 *
 * Invariants:
 * - Extract-only split from legacy RealtorObjectsWorkspacePanel; behavior unchanged.
 *
 * Related:
 * - RealtorObjectsWorkspaceShell.tsx
 */

import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';
import {
	toInputValue,
	toNullableNumber,
} from '../../utils/professionalWorldsFormUtils';

import { useRealtorObjectsPanelVm } from './panelVm';

export function ListingWorkspaceEditPanel() {
	const vm = useRealtorObjectsPanelVm();
	const selectedProperty = vm.selectedProperty;
	if (!selectedProperty) {
		return null;
	}
	return (
		<>
			<DesktopAppSurface
				role="region"
				aria-label={vm.t('properties.activeContextTitle')}
				variant="soft"
				padding="md"
				className="border border-[rgb(var(--desktop-accent-rgb))]/20 bg-[rgb(var(--desktop-accent-rgb))]/5"
			>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<DesktopAppSectionLabel>
							{vm.t('properties.activeContextTitle')}
						</DesktopAppSectionLabel>
						<p className="mt-1 text-sm font-semibold text-(--desktop-text-primary)">
							{selectedProperty.title}
						</p>
						<p className="mt-1 text-xs leading-5 text-(--desktop-text-secondary)">
							{vm.t('properties.activeContextBody', {
								city: selectedProperty.city || '—',
								deal: vm.t(
									`properties.dealTypes.${selectedProperty.deal_type}`,
									{
										defaultValue: selectedProperty.deal_type ?? '—',
									}
								),
							})}
						</p>
					</div>
				</div>
			</DesktopAppSurface>
			<ProfessionalWorldsWorkspacePanel
				title={vm.t('properties.listingEditTitle')}
				dense
			>
				<p className="text-xs leading-5 text-(--desktop-text-secondary)">
					{vm.t('properties.listingEditLead')}
				</p>
				<div className="grid gap-3 md:grid-cols-2">
					<ProfessionalWorldsFormField label={vm.t('properties.title')}>
						<DesktopAppInput
							value={vm.propertyDraft.title}
							onChange={(event) =>
								vm.setPropertyDraft((current) => ({
									...current,
									title: event.target.value,
								}))
							}
							placeholder={vm.t('properties.titlePlaceholder')}
						/>
					</ProfessionalWorldsFormField>
					<ProfessionalWorldsFormField label={vm.t('properties.price')}>
						<DesktopAppInput
							value={toInputValue(vm.propertyDraft.price)}
							onChange={(event) =>
								vm.setPropertyDraft((current) => ({
									...current,
									price: toNullableNumber(event.target.value),
								}))
							}
							placeholder={vm.t('properties.pricePlaceholder')}
						/>
					</ProfessionalWorldsFormField>
					<ProfessionalWorldsFormField label={vm.t('properties.area')}>
						<DesktopAppInput
							value={toInputValue(vm.propertyDraft.area_m2)}
							onChange={(event) =>
								vm.setPropertyDraft((current) => ({
									...current,
									area_m2: toNullableNumber(event.target.value),
								}))
							}
							placeholder={vm.t('properties.areaPlaceholder')}
						/>
					</ProfessionalWorldsFormField>
					<ProfessionalWorldsFormField label={vm.t('properties.rooms')}>
						<DesktopAppInput
							value={toInputValue(vm.propertyDraft.rooms)}
							onChange={(event) =>
								vm.setPropertyDraft((current) => ({
									...current,
									rooms: toNullableNumber(event.target.value),
								}))
							}
							placeholder={vm.t('properties.roomsPlaceholder')}
						/>
					</ProfessionalWorldsFormField>
				</div>
				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						variant="ghost"
						disabled={vm.saving || !vm.propertyDraft.title.trim()}
						onClick={() => void vm.handleUpdateSelectedProperty()}
					>
						{vm.t('actions.saveObject')}
					</DesktopAppButton>
				</div>
			</ProfessionalWorldsWorkspacePanel>
		</>
	);
}
