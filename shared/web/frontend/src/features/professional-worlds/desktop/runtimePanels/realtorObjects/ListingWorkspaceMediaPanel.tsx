/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Listing media upload, library batch, and workbench section.
 *
 * Invariants:
 * - Extract-only split from legacy RealtorObjectsWorkspacePanel; behavior unchanged.
 *
 * Related:
 * - RealtorObjectsWorkspaceShell.tsx
 */

import { ContentType } from '@/types/fileExchange';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { SupportDetailsPanel } from '../../components/SupportDetailsPanel';
import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';
import { PW_PIPELINE_STATUS_CHIP_CLASS } from '../../layout/professionalWorldsLayoutTokens';
import { photoPresetDisplayName } from '../../photoPresetDisplay';
import { ProfessionalMediaWorkbench } from '../../ProfessionalMediaWorkbench';
import { UnifiedContentPickerBridge } from '../../UnifiedContentPickerBridge';

import { formatUploadStatus, LISTING_MEDIA_SECTION_ID } from './shared';
import { useRealtorObjectsPanelVm } from './panelVm';

export function ListingWorkspaceMediaPanel() {
	const vm = useRealtorObjectsPanelVm();
	const selectedProperty = vm.selectedProperty;
	if (!selectedProperty) {
		return null;
	}
	return (
		<>
			{vm.mediaStudioEnabled ? (
				<div className="scroll-mt-4" id={LISTING_MEDIA_SECTION_ID}>
					<ProfessionalWorldsWorkspacePanel
						title={vm.t('properties.listingWorkspaceMedia')}
					>
						{vm.embeddedMobileLayout ? (
							<p className="text-sm text-(--desktop-text-secondary)">
								{vm.t('properties.mobilePhotosLead')}
							</p>
						) : null}
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
								void vm.handleMediaLibraryBatch(selection.items, selection.ids);
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
								disabled={
									vm.saving ||
									vm.mediaPipelineBusy ||
									(!vm.uploadWithoutProcessing && !vm.photoPresetKey)
								}
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
						<SupportDetailsPanel
							className="grid gap-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 p-3"
							summaryClassName="text-sm font-medium text-(--desktop-text-secondary)"
							summary={vm.t('properties.photoAdvancedSummary')}
						>
							<div className="grid gap-3">
								<p className="text-xs leading-5 text-(--desktop-text-secondary)">
									{vm.t('properties.photoAdvancedLead')}
								</p>
								<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
									<label className="flex items-center gap-2 text-xs text-(--desktop-text-secondary)">
										<input
											type="checkbox"
											checked={vm.uploadWithoutProcessing}
											disabled={vm.saving || vm.mediaPipelineBusy}
											onChange={(e) =>
												vm.setUploadWithoutProcessing(e.target.checked)
											}
										/>
										{vm.t('properties.vm.uploadWithoutProcessing')}
									</label>
								</div>
								<div className="grid grid-cols-1 gap-2 pt-1 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:items-end">
									<DesktopNativeSelect
										disabled={
											vm.uploadWithoutProcessing || vm.mediaPipelineBusy
										}
										value={vm.photoPresetKey}
										onChange={(event) =>
											vm.setPhotoPresetKey(event.target.value)
										}
									>
										{vm.resolvedPhotoPresets.map((preset) => (
											<option key={preset.preset_key} value={preset.preset_key}>
												{photoPresetDisplayName(preset, vm.t)}
											</option>
										))}
									</DesktopNativeSelect>
									<DesktopAppInput
										disabled={
											vm.uploadWithoutProcessing || vm.mediaPipelineBusy
										}
										value={vm.photoInstruction}
										onChange={(event) =>
											vm.setPhotoInstruction(event.target.value)
										}
										placeholder={vm.t('properties.vm.photoInstruction')}
									/>
								</div>
								<div className="grid gap-2 md:grid-cols-[minmax(0,20rem)_1fr] md:items-center">
									<ProfessionalWorldsFormField
										htmlFor={vm.batchTargetAlbumSelectId}
										label={vm.t('properties.batchTargetAlbum')}
									>
										<DesktopNativeSelect
											id={vm.batchTargetAlbumSelectId}
											disabled={vm.mediaPipelineBusy}
											value={vm.batchTargetAlbumId}
											onChange={(event) =>
												vm.setBatchTargetAlbumId(event.target.value)
											}
										>
											<option value="">
												{vm.t('properties.batchTargetAlbumNone')}
											</option>
											{vm.listingAlbums.map((album) => (
												<option key={album.id} value={album.id}>
													{album.title}
												</option>
											))}
										</DesktopNativeSelect>
									</ProfessionalWorldsFormField>
									<p className="text-xs text-(--desktop-text-muted)">
										{vm.t('properties.batchTargetAlbumHint')}
									</p>
								</div>
								{!vm.embeddedMobileLayout ? (
									<ProfessionalMediaWorkbench
										contextType="realtor"
										targetId={selectedProperty.id}
										brandVerticalSlug={vm.workspace.activeVerticalSlug}
										hideBrandKit
										listingMediaRefreshAt={vm.listingMediaRefreshAt}
										listingTitle={selectedProperty.title}
										onListingMediaChanged={() =>
											vm.setListingMediaRefreshAt(Date.now())
										}
										runtimePresetOptions={vm.resolvedPhotoPresets}
										onNotice={(msg) => vm.setLaneStatus('listing', msg)}
									/>
								) : null}
							</div>
						</SupportDetailsPanel>
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
		</>
	);
}
