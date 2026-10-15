/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * New-draft intake form and property create flow.
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

import { SupportDetailsPanel } from '../../components/SupportDetailsPanel';
import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsOutcomeCard,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTextarea,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';
import { explainIntakeDiagnostics } from '../../objectIntakeDiagnostics';
import { buildJtbdPreview } from '../../realtorLogic';
import {
	toInputValue,
	toNullableNumber,
} from '../../utils/professionalWorldsFormUtils';
import {
	userFacingDealTypeLabel,
	userFacingPropertyTypeLabel,
} from '../../userFacingContentLabels';

import { useRealtorObjectsPanelVm } from './panelVm';

export function ObjectIntakePanel() {
	const vm = useRealtorObjectsPanelVm();
	return (
		<ProfessionalWorldsWorkspacePanel title={vm.t('properties.new')}>
			<DesktopAppSurface variant="soft" padding="md" className="grid gap-2">
				<DesktopAppSectionLabel>
					{vm.t('properties.intakeTitle')}
				</DesktopAppSectionLabel>
				<ProfessionalWorldsTextarea
					className="min-h-36 resize-y"
					value={vm.objectIntakeText}
					onChange={(event) => vm.setObjectIntakeText(event.target.value)}
					placeholder={vm.t('properties.intakePlaceholder')}
				/>
				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						disabled={vm.objectIntakeText.trim().length < 20}
						onClick={() => void vm.handleObjectIntake()}
					>
						{vm.t('properties.parseIntake')}
					</DesktopAppButton>
					<DesktopAppButton
						variant="ghost"
						disabled={!vm.objectIntakePreview || vm.saving}
						onClick={() => void vm.handleCommitObjectIntake()}
					>
						{vm.t('properties.commitIntake')}
					</DesktopAppButton>
				</div>
				{vm.objectIntakePreview && (
					<div className="grid min-h-0 gap-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-3 text-xs text-(--desktop-text-secondary)">
						{(() => {
							const diag = vm.objectIntakePreview.intake_diagnostics;
							if (!diag?.intake_fallback) {
								return null;
							}
							return (
								<ProfessionalWorldsStatusBanner
									kind="warning"
									role="alert"
									className="text-[13px]"
								>
									<span className="block font-semibold">
										{vm.t('properties.intakeReviewBannerTitle')}
									</span>
									<span className="mt-1 block leading-snug text-[12px] text-(--desktop-text-secondary)">
										{explainIntakeDiagnostics(diag, (key) => vm.t(key))}
									</span>
								</ProfessionalWorldsStatusBanner>
							);
						})()}
						<strong className="text-sm text-(--desktop-text-primary)">
							{vm.objectIntakePreview.property.title}
						</strong>
						<dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
							<div>
								<dt className="text-(--desktop-text-dim)">
									{vm.t('properties.cityField')}
								</dt>
								<dd className="text-(--desktop-text-primary)">
									{vm.objectIntakePreview.property.city ?? '—'}
								</dd>
							</div>
							<div>
								<dt className="text-(--desktop-text-dim)">
									{vm.t('properties.dealField')}
								</dt>
								<dd className="text-(--desktop-text-primary)">
									{userFacingDealTypeLabel(
										vm.t,
										vm.objectIntakePreview.property.deal_type
									)}
								</dd>
							</div>
							<div>
								<dt className="text-(--desktop-text-dim)">
									{vm.t('properties.typeField')}
								</dt>
								<dd className="text-(--desktop-text-primary)">
									{userFacingPropertyTypeLabel(
										vm.t,
										vm.objectIntakePreview.property.property_type
									)}
								</dd>
							</div>
							<div>
								<dt className="text-(--desktop-text-dim)">
									{vm.t('properties.price')}
								</dt>
								<dd className="text-(--desktop-text-primary)">
									{vm.objectIntakePreview.property.price ?? '—'}
								</dd>
							</div>
							<div>
								<dt className="text-(--desktop-text-dim)">
									{vm.t('properties.area')}
								</dt>
								<dd className="text-(--desktop-text-primary)">
									{vm.objectIntakePreview.property.area_m2 ?? '—'}
								</dd>
							</div>
							<div>
								<dt className="text-(--desktop-text-dim)">
									{vm.t('properties.rooms')}
								</dt>
								<dd className="text-(--desktop-text-primary)">
									{vm.objectIntakePreview.property.rooms ?? '—'}
								</dd>
							</div>
						</dl>
						{vm.objectIntakePreview.warnings.length > 0 && (
							<div className="grid gap-1">
								<span className="text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-secondary)">
									{vm.t('properties.intakeWarningsHeading')}
								</span>
								<ul className="grid gap-1 text-amber-200">
									{vm.objectIntakePreview.warnings.map((warning) => (
										<li key={warning}>• {warning}</li>
									))}
								</ul>
							</div>
						)}
						<SupportDetailsPanel
							className="rounded-(--desktop-radius-sm) border border-(--desktop-border-subtle) bg-(--desktop-text-primary)/4 p-2"
							summaryClassName="text-[11px] font-medium text-(--desktop-text-secondary)"
							summary={vm.t('properties.intakeSupportDetails')}
						>
							<pre className="max-h-[min(480px,55vh)] min-h-40 w-full overflow-auto overscroll-contain whitespace-pre-wrap wrap-break-word font-mono text-[11px] leading-relaxed text-(--desktop-text-primary)">
								{JSON.stringify(
									{
										property: vm.objectIntakePreview.property,
										confidence: vm.objectIntakePreview.confidence,
										warnings: vm.objectIntakePreview.warnings,
										intake_diagnostics:
											vm.objectIntakePreview.intake_diagnostics,
									},
									null,
									2
								)}
							</pre>
						</SupportDetailsPanel>
					</div>
				)}
			</DesktopAppSurface>
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
			<div className="grid gap-3 md:grid-cols-2">
				<ProfessionalWorldsFormField label={vm.t('properties.district')}>
					<DesktopAppInput
						value={vm.propertyDraft.district ?? ''}
						onChange={(event) =>
							vm.setPropertyDraft((current) => ({
								...current,
								district: event.target.value,
							}))
						}
						placeholder={vm.t('properties.districtPlaceholder')}
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
			<ProfessionalWorldsFormField label={vm.t('properties.view')}>
				<DesktopAppInput
					value={vm.propertyDraft.view ?? ''}
					onChange={(event) =>
						vm.setPropertyDraft((current) => ({
							...current,
							view: event.target.value,
						}))
					}
					placeholder={vm.t('properties.viewPlaceholder')}
				/>
			</ProfessionalWorldsFormField>
			<ProfessionalWorldsFormField label={vm.t('properties.infrastructure')}>
				<DesktopAppInput
					value={vm.infrastructureCsv}
					onChange={(event) => vm.setInfrastructureCsv(event.target.value)}
					placeholder={vm.t('properties.infrastructurePlaceholder')}
				/>
			</ProfessionalWorldsFormField>
			<SupportDetailsPanel
				className="grid gap-3"
				summary={vm.t('jtbd.advancedSummary')}
			>
				<ProfessionalWorldsFormField label={vm.t('jtbd.trigger')}>
					<textarea
						className={vm.fieldClassName}
						value={vm.propertyDraft.jtbd_context?.trigger_context ?? ''}
						onChange={(event) =>
							vm.setPropertyDraft((current) => ({
								...current,
								jtbd_context: {
									...(current.jtbd_context ?? {}),
									trigger_context: event.target.value,
								},
							}))
						}
						placeholder={vm.t('jtbd.triggerPlaceholder')}
					/>
				</ProfessionalWorldsFormField>
				<ProfessionalWorldsFormField label={vm.t('jtbd.result')}>
					<textarea
						className={vm.fieldClassName}
						value={vm.propertyDraft.jtbd_context?.expected_result ?? ''}
						onChange={(event) =>
							vm.setPropertyDraft((current) => ({
								...current,
								jtbd_context: {
									...(current.jtbd_context ?? {}),
									expected_result: event.target.value,
								},
							}))
						}
						placeholder={vm.t('jtbd.resultPlaceholder')}
					/>
				</ProfessionalWorldsFormField>
				<ProfessionalWorldsFormField label={vm.t('jtbd.emotion')}>
					<textarea
						className={vm.fieldClassName}
						value={
							vm.propertyDraft.jtbd_context?.emotional_transformation ?? ''
						}
						onChange={(event) =>
							vm.setPropertyDraft((current) => ({
								...current,
								jtbd_context: {
									...(current.jtbd_context ?? {}),
									emotional_transformation: event.target.value,
								},
							}))
						}
						placeholder={vm.t('jtbd.emotionPlaceholder')}
					/>
				</ProfessionalWorldsFormField>
				<p className="text-xs text-(--desktop-text-secondary)">
					{buildJtbdPreview(vm.propertyDraft)}
				</p>
			</SupportDetailsPanel>
			<div className="flex flex-wrap gap-2">
				<DesktopAppButton
					variant="ghost"
					disabled={vm.saving}
					onClick={() => {
						vm.setSelectedPropertyId(null);
						vm.setPropertyDraft(vm.resetPropertyDraft());
						vm.setInfrastructureCsv('');
						vm.clearLastCreatedProperty();
					}}
				>
					{vm.t('actions.newObjectDraft')}
				</DesktopAppButton>
				<DesktopAppButton
					disabled={vm.saving || !vm.propertyDraft.title.trim()}
					onClick={() => void vm.handleCreateProperty()}
				>
					{vm.t('actions.createObject')}
				</DesktopAppButton>
			</div>
			{vm.lastCreatedProperty ? (
				<ProfessionalWorldsOutcomeCard
					title={vm.t('properties.postCreateTitle')}
					description={vm.t('properties.postCreateBody', {
						title: vm.lastCreatedProperty.title,
					})}
					supportSummary={vm.t('properties.postCreateSupportSummary')}
					supportDetail={vm.t('properties.postCreateSupportDetail')}
					actions={
						<>
							<DesktopAppButton
								type="button"
								onClick={() => vm.setPropertiesWorkspaceTab('listingWorkspace')}
							>
								{vm.t('properties.postCreateOpenWorkspace')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								onClick={() => {
									vm.setPropertiesWorkspaceTab('listingWorkspace');
									vm.setLaneStatus(
										'listing',
										vm.t('properties.postCreatePhotoNext')
									);
								}}
							>
								{vm.t('properties.postCreateAddPhotos')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								onClick={() => {
									vm.setPropertiesWorkspaceTab('listingWorkspace');
									vm.setLaneStatus(
										'listing',
										vm.t('properties.postCreateDescriptionNext')
									);
								}}
							>
								{vm.t('properties.postCreatePrepareDescription')}
							</DesktopAppButton>
						</>
					}
				/>
			) : null}
		</ProfessionalWorldsWorkspacePanel>
	);
}
