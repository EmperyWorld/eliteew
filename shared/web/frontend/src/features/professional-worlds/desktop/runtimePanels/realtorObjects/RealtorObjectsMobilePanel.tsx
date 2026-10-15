/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile-embedded realtor objects workspace (listings pick + photo upload).
 *
 * Invariants:
 * - Simpler media path than desktop; upload-without-processing forced by shell effect.
 *
 * Related:
 * - RealtorObjectsWorkspaceShell.tsx
 */

import { ContentType } from '@/types/fileExchange';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { PropertySavedListingCard } from '../../components/PropertySavedListingCard';
import {
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSection,
} from '../../layout';
import { PW_PIPELINE_STATUS_CHIP_CLASS } from '../../layout/professionalWorldsLayoutTokens';
import {
	userFacingDealTypeLabel,
	userFacingPropertyTypeLabel,
} from '../../userFacingContentLabels';
import { UnifiedContentPickerBridge } from '../../UnifiedContentPickerBridge';

import { formatUploadStatus, LISTING_MEDIA_SECTION_ID } from './shared';
import { useRealtorObjectsPanelVm } from './panelVm';

export function RealtorObjectsMobilePanel() {
	const vm = useRealtorObjectsPanelVm();
	return (
		<ProfessionalWorldsWorkspaceSection>
			{!vm.selectedProperty ? (
				<>
					<p className="text-sm text-(--desktop-text-secondary)">
						{vm.t('properties.savedListingsLead')}
					</p>
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
							/>
						) : (
							<div className="grid gap-3 sm:grid-cols-2">
								{vm.snapshot.properties.map((property) => (
									<div className="grid gap-2" key={property.id}>
										<PropertySavedListingCard
											coverEntry={
												vm.listingCoverStatesByPropertyId[property.id]
											}
											listingCoverMediaRevision={vm.listingMediaRefreshAt ?? 0}
											property={property}
											registerListingCoverInterest={
												vm.registerListingCoverInterest
											}
											selected={vm.selectedPropertyId === property.id}
											t={vm.t}
											onSelect={() => {
												vm.setSelectedPropertyId(property.id);
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
					</ProfessionalWorldsWorkspacePanel>
				</>
			) : (
				<div className="grid gap-3">
					<p className="text-sm text-(--desktop-text-secondary)">
						{vm.t('properties.mobilePhotosLead')}
					</p>
					<DesktopAppSurface
						role="region"
						aria-label={vm.t('properties.activeContextTitle')}
						variant="soft"
						padding="md"
						className="border border-[rgb(var(--desktop-accent-rgb))]/20 bg-[rgb(var(--desktop-accent-rgb))]/5"
					>
						<DesktopAppSectionLabel>
							{vm.t('properties.activeContextTitle')}
						</DesktopAppSectionLabel>
						<p className="mt-1 text-sm font-semibold text-(--desktop-text-primary)">
							{vm.selectedProperty.title}
						</p>
						<p className="mt-1 text-xs leading-5 text-(--desktop-text-secondary)">
							{vm.t('properties.activeContextBody', {
								city: vm.selectedProperty.city || '—',
								deal: vm.t(
									`properties.dealTypes.${vm.selectedProperty.deal_type}`,
									{
										defaultValue: vm.selectedProperty.deal_type ?? '—',
									}
								),
							})}
						</p>
					</DesktopAppSurface>
					<ProfessionalWorldsWorkspacePanel
						title={vm.t('properties.listingEditTitle')}
						dense
					>
						<dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
							<div>
								<dt className="text-xs text-(--desktop-text-dim)">
									{vm.t('properties.cityField')}
								</dt>
								<dd className="text-sm text-(--desktop-text-primary)">
									{vm.selectedProperty.city ?? '—'}
								</dd>
							</div>
							<div>
								<dt className="text-xs text-(--desktop-text-dim)">
									{vm.t('properties.dealField')}
								</dt>
								<dd className="text-sm text-(--desktop-text-primary)">
									{userFacingDealTypeLabel(vm.t, vm.selectedProperty.deal_type)}
								</dd>
							</div>
							<div>
								<dt className="text-xs text-(--desktop-text-dim)">
									{vm.t('properties.typeField')}
								</dt>
								<dd className="text-sm text-(--desktop-text-primary)">
									{userFacingPropertyTypeLabel(
										vm.t,
										vm.selectedProperty.property_type
									)}
								</dd>
							</div>
							<div>
								<dt className="text-xs text-(--desktop-text-dim)">
									{vm.t('properties.price')}
								</dt>
								<dd className="text-sm text-(--desktop-text-primary)">
									{vm.selectedProperty.price ?? '—'}
								</dd>
							</div>
							<div>
								<dt className="text-xs text-(--desktop-text-dim)">
									{vm.t('properties.area')}
								</dt>
								<dd className="text-sm text-(--desktop-text-primary)">
									{vm.selectedProperty.area_m2 ?? '—'}
								</dd>
							</div>
							<div>
								<dt className="text-xs text-(--desktop-text-dim)">
									{vm.t('properties.rooms')}
								</dt>
								<dd className="text-sm text-(--desktop-text-primary)">
									{vm.selectedProperty.rooms ?? '—'}
								</dd>
							</div>
						</dl>
						<div className="mt-3 flex flex-wrap gap-2">
							<DesktopAppButton
								variant="ghost"
								onClick={() => vm.setSelectedPropertyId(null)}
							>
								{vm.t('properties.workspaceOpenListings')}
							</DesktopAppButton>
						</div>
					</ProfessionalWorldsWorkspacePanel>
					{vm.mediaStudioEnabled ? (
						<div className="scroll-mt-4" id={LISTING_MEDIA_SECTION_ID}>
							<ProfessionalWorldsWorkspacePanel
								title={vm.t('properties.listingWorkspaceMedia')}
							>
								<UnifiedContentPickerBridge
									embedded
									allowedContentTypes={[ContentType.IMAGE]}
									buttonLabel={vm.t('properties.photoLibraryButton')}
									confirmLabel={vm.t('properties.mediaPickConfirm')}
									description={vm.t('properties.photoSimpleLead')}
									disabled={vm.saving || vm.mediaPipelineBusy}
									emptyDescription={vm.t('properties.mediaPickEmptyBody')}
									emptyTitle={vm.t('properties.mediaPickEmptyTitle')}
									maxFiles={20}
									mode="multi"
									onChange={(selection) => {
										void vm.handleMediaLibraryBatch(
											selection.items,
											selection.ids
										);
										vm.setMediaPickerItems([]);
									}}
									pickerTitle={vm.t('properties.mediaPickModalTitle')}
									selectedItems={vm.mediaPickerItems}
									title={vm.t('properties.photoLibraryTitle')}
								/>
								<input
									ref={vm.uploadEnhanceInputRef}
									type="file"
									accept="image/*"
									multiple
									className="hidden"
									onChange={(event) => {
										const list = event.target.files;
										void vm.handleMultiPhotoUploadEnhance(
											list ? Array.from(list) : []
										);
										event.target.value = '';
									}}
								/>
								<div className="flex flex-wrap items-center gap-2">
									<DesktopAppButton
										className="w-full justify-center sm:w-auto"
										aria-busy={vm.mediaPipelineBusy}
										disabled={vm.saving || vm.mediaPipelineBusy}
										onClick={() => vm.uploadEnhanceInputRef.current?.click()}
									>
										{vm.t('properties.photoUploadButton')}
									</DesktopAppButton>
									<p className="text-xs leading-5 text-(--desktop-text-secondary)">
										{vm.t('properties.photoUploadHint')}
									</p>
								</div>
								{vm.uploadProgressRows.length > 0 ? (
									<div className="grid gap-2 rounded-(--desktop-radius-sm) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/70 p-2">
										<p className="text-xs font-medium text-(--desktop-text-secondary)">
											{vm.t('properties.photoProgressTitle')}
										</p>
										<ul className="grid gap-1">
											{vm.uploadProgressRows.map((row) => (
												<li
													key={row.id}
													className="flex flex-wrap items-center justify-between gap-2 rounded-(--desktop-radius-xs) border border-(--desktop-border-soft) bg-(--desktop-surface-raised) px-2 py-1 text-xs"
												>
													<span className="truncate text-(--desktop-text-primary)">
														{row.fileName}
													</span>
													<span
														className={
															row.status === 'done'
																? PW_PIPELINE_STATUS_CHIP_CLASS.done
																: row.status === 'failed'
																	? PW_PIPELINE_STATUS_CHIP_CLASS.failed
																	: row.status === 'processing'
																		? PW_PIPELINE_STATUS_CHIP_CLASS.processing
																		: PW_PIPELINE_STATUS_CHIP_CLASS.idle
														}
													>
														{formatUploadStatus(vm.t, row.status)}
													</span>
													<span className="w-full text-(--desktop-text-muted)">
														{row.message}
													</span>
												</li>
											))}
										</ul>
									</div>
								) : null}
								{vm.mediaPipelineBusy ? (
									<p
										className="text-xs text-(--desktop-text-secondary)"
										role="status"
										aria-live="polite"
									>
										{vm.t('properties.vm.mediaPipelineBusy')}
									</p>
								) : null}
							</ProfessionalWorldsWorkspacePanel>
						</div>
					) : (
						<ProfessionalWorldsWorkspacePanel
							title={vm.t('properties.listingWorkspaceMedia')}
							dense
						>
							<ProfessionalWorldsStatusBanner kind="info">
								{vm.t('properties.mediaStudioDisabled')}
							</ProfessionalWorldsStatusBanner>
						</ProfessionalWorldsWorkspacePanel>
					)}
				</div>
			)}
		</ProfessionalWorldsWorkspaceSection>
	);
}
