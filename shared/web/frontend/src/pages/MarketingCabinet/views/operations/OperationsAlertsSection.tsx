/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketing Cabinet operations alerts panel: virtualized list, CRUD form, and
 * dashboard deep-link empty states.
 *
 * Invariants:
 * - Long alert lists use windowed virtualization (MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD).
 * - Behavior matches pre-atomization OperationsView alerts branch.
 *
 * Related:
 * - OperationsView.tsx
 * - useOperationsView.ts
 */

import { VirtualVariableList } from '@/components/shared/VirtualList';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	BellIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppInput,
	DesktopAppSurface,
} from '../../../Desktop/components/DesktopAppChrome';
import { DocumentAutofillAction } from '../../components/DocumentAutofillAction';
import { MarketingSectionGenerateAiButton } from '../../components/MarketingSectionGenerateAiButton';
import { InputLabel } from '../../components/FieldLabel';
import { LoadingGrid } from '../../components/LoadingGrid';
import { MarketingCabinetSelect } from '../../components/MarketingCabinetSelect';
import { SectionPanel } from '../../components/SectionPanel';
import {
	INPUT_STACK_CLASS,
	MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD,
	TEXTAREA_CLASS,
} from '../../constants';
import { localizeAlertSeverity, localizeStatus } from '../../locales';
import type { MarketingAlert } from '../../marketingCabinetApi';
import {
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
} from '../../marketingCabinetQueryOptions';
import { extractApiErrorMessage } from '../../utils';
import {
	alertSeverityBadgeClass,
	alertStatusBadgeClass,
	getLocalizedAlertCopy,
	initialAlertForm,
} from './operationsHelpers';
import type { OperationsViewController } from './useOperationsView';

type OperationsAlertsSectionProps = {
	ops: OperationsViewController;
	projectId: string;
};

export function OperationsAlertsSection({
	ops,
	projectId,
}: OperationsAlertsSectionProps) {
	const {
		t,
		focusedEntityId,
		allowMarketingWrite,
		alertSeverityOptions,
		alertStatusOptions,
		alertIds,
		alertForm,
		setAlertForm,
		editingAlert,
		setEditingAlert,
		alertsQuery,
		createAlertMutation,
		updateAlertMutation,
		deleteAlertMutation,
		alertItems,
		alertsTotal,
		alertsTruncated,
		sortedAlerts,
		displayAlerts,
	} = ops;

	const isPending =
		createAlertMutation.isPending || updateAlertMutation.isPending;

	const renderAlertRow = (alert: MarketingAlert) => {
		const displayAlert = getLocalizedAlertCopy(alert, t);
		const deletingThis =
			deleteAlertMutation.isPending &&
			deleteAlertMutation.variables === alert.id;
		return (
			<DesktopAppSurface
				variant="soft"
				data-marketing-entity-id={alert.id}
				className={cn(
					'space-y-3 p-4 transition-[box-shadow,border-color]',
					'hover:border-(--desktop-border-strong)/70',
					focusedEntityId === alert.id && 'ring-1 ring-(--mc-accent-60)'
				)}
			>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1 space-y-2">
						<div className="text-sm font-medium leading-snug text-(--desktop-text-primary)">
							{displayAlert.title}
						</div>
						<div className="flex flex-wrap items-center gap-1.5">
							<span
								className={cn(
									'inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
									alertSeverityBadgeClass(alert.severity)
								)}
							>
								{localizeAlertSeverity(alert.severity || 'medium')}
							</span>
							<span
								className={cn(
									'inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
									alertStatusBadgeClass(alert.status)
								)}
							>
								{localizeStatus(alert.status)}
							</span>
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{alert.owner_name || t('common.ownerUnset')}
							</span>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								setEditingAlert(alert);
								setAlertForm({
									title: displayAlert.title,
									description: displayAlert.description || '',
									severity: alert.severity || 'medium',
									status: alert.status || 'open',
									owner_name: alert.owner_name || '',
								});
							}}
						>
							{t('common.edit')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							disabled={deletingThis}
							onClick={() => deleteAlertMutation.mutate(alert.id)}
							aria-label={t('operationsView.alerts.deleteAria', {
								name: displayAlert.title,
							})}
						>
							{deletingThis ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : (
								<TrashIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							)}
						</DesktopAppButton>
					</div>
				</div>
				{displayAlert.description ? (
					<p className="text-sm leading-6 text-(--desktop-text-secondary)">
						{displayAlert.description}
					</p>
				) : null}
			</DesktopAppSurface>
		);
	};

	return (
		<div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
			<SectionPanel
				title={t('operationsView.alerts.panelTitle')}
				description={t('operationsView.alerts.panelDescription')}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						{allowMarketingWrite ? (
							<MarketingSectionGenerateAiButton
								projectId={projectId}
								targetSection="alerts"
								allowMarketingWrite={allowMarketingWrite}
								invalidateQueryKeys={[
									marketingCabinetProjectSectionInvalidationQueryKey(
										'alerts',
										projectId
									),
									marketingCabinetProjectDashboardInvalidationQueryKey(
										projectId
									),
								]}
							/>
						) : null}
						<DocumentAutofillAction
							projectId={projectId}
							targetSection="alerts"
							targetLabel={t('operationsView.alerts.docAutofillLabel')}
							invalidateQueryKeys={[
								marketingCabinetProjectSectionInvalidationQueryKey(
									'alerts',
									projectId
								),
								marketingCabinetProjectDashboardInvalidationQueryKey(projectId),
							]}
						/>
					</div>
				}
			>
				{alertsQuery.isLoading ? (
					<LoadingGrid />
				) : alertsQuery.isError ? (
					<DesktopAppErrorState
						message={extractApiErrorMessage(
							alertsQuery.error,
							t('operationsView.alerts.loadErrorDefault')
						)}
						onAction={() => void alertsQuery.refetch()}
					/>
				) : displayAlerts.length > 0 ? (
					<>
						<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
							{alertsTruncated
								? t('cabinetPage.listFetchSummaryTruncated', {
										shown: alertItems.length,
										total: alertsTotal,
									})
								: t('cabinetPage.listFetchSummaryAll', {
										count: displayAlerts.length,
									})}
						</p>
						{displayAlerts.length > MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
							<VirtualVariableList
								items={displayAlerts}
								estimateSize={() => 140}
								getItemKey={(index) =>
									displayAlerts[index]?.id ?? `alert-${index}`
								}
								height={480}
								overscanCount={6}
								className="rounded-(--desktop-radius)"
								renderItem={(alert) => (
									<div className="pb-3">{renderAlertRow(alert)}</div>
								)}
							/>
						) : (
							<ul
								className="m-0 list-none space-y-3 p-0"
								aria-label={t('operationsView.alerts.panelTitle')}
							>
								{displayAlerts.map((alert) => (
									<li key={alert.id}>{renderAlertRow(alert)}</li>
								))}
							</ul>
						)}
					</>
				) : sortedAlerts.length > 0 ? (
					<DesktopAppEmptyState
						className="rounded-(--desktop-radius-lg) border border-dashed border-(--desktop-border-subtle)/90 bg-(--desktop-surface-soft)/40 py-10"
						icon={
							<BellIcon
								className="h-8 w-8 text-(--desktop-text-muted)"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						}
						title={t('operationsView.alerts.urlFilterEmptyTitle')}
						description={t('operationsView.alerts.urlFilterEmptyDescription')}
					/>
				) : (
					<DesktopAppEmptyState
						className="rounded-(--desktop-radius-lg) border border-dashed border-(--desktop-border-subtle)/90 bg-(--desktop-surface-soft)/40 py-10"
						icon={
							<BellIcon
								className="h-8 w-8 text-(--desktop-text-muted)"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						}
						title={t('operationsView.alerts.emptyTitle')}
						description={t('operationsView.alerts.emptyDescription')}
					/>
				)}
			</SectionPanel>
			<SectionPanel
				title={
					editingAlert
						? t('operationsView.alerts.formEditTitle')
						: t('operationsView.alerts.formNewTitle')
				}
				description={t('operationsView.alerts.formDescription')}
				className={cn(
					editingAlert &&
						'ring-1 ring-(--mc-accent-50)/80 shadow-[0_0_0_1px_color-mix(in_srgb,var(--mc-accent)_18%,transparent)]'
				)}
			>
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!alertForm.title.trim()) return;
						if (editingAlert) {
							void updateAlertMutation.mutateAsync();
							return;
						}
						void createAlertMutation.mutateAsync();
					}}
					aria-busy={isPending}
				>
					<div className="space-y-2">
						<InputLabel htmlFor={alertIds.title} required>
							{t('operationsView.alerts.fieldTitle')}
						</InputLabel>
						<DesktopAppInput
							id={alertIds.title}
							value={alertForm.title}
							onChange={(event) =>
								setAlertForm((prev) => ({ ...prev, title: event.target.value }))
							}
						/>
					</div>
					<div className="space-y-2">
						<InputLabel htmlFor={alertIds.description}>
							{t('operationsView.alerts.fieldDescription')}
						</InputLabel>
						<textarea
							id={alertIds.description}
							className={TEXTAREA_CLASS}
							value={alertForm.description}
							onChange={(event) =>
								setAlertForm((prev) => ({
									...prev,
									description: event.target.value,
								}))
							}
						/>
					</div>
					<div className={INPUT_STACK_CLASS}>
						<div className="space-y-2">
							<InputLabel htmlFor={alertIds.severity}>
								{t('operationsView.alerts.fieldSeverity')}
							</InputLabel>
							<MarketingCabinetSelect
								id={alertIds.severity}
								value={alertForm.severity}
								onChange={(severity) =>
									setAlertForm((prev) => ({ ...prev, severity }))
								}
								options={alertSeverityOptions}
							/>
						</div>
						<div className="space-y-2">
							<InputLabel htmlFor={alertIds.status}>
								{t('operationsView.alerts.fieldStatus')}
							</InputLabel>
							<MarketingCabinetSelect
								id={alertIds.status}
								value={alertForm.status}
								onChange={(status) =>
									setAlertForm((prev) => ({ ...prev, status }))
								}
								options={alertStatusOptions}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<InputLabel htmlFor={alertIds.owner}>
							{t('operationsView.alerts.fieldOwner')}
						</InputLabel>
						<DesktopAppInput
							id={alertIds.owner}
							value={alertForm.owner_name}
							onChange={(event) =>
								setAlertForm((prev) => ({
									...prev,
									owner_name: event.target.value,
								}))
							}
						/>
					</div>
					{createAlertMutation.isError || updateAlertMutation.isError ? (
						<DesktopAppErrorState
							message={extractApiErrorMessage(
								createAlertMutation.error || updateAlertMutation.error,
								t('operationsView.alerts.saveErrorDefault')
							)}
						/>
					) : null}
					<div className="flex items-center justify-end gap-2">
						{editingAlert ? (
							<DesktopAppButton
								type="button"
								variant="ghost"
								onClick={() => {
									setEditingAlert(null);
									setAlertForm(initialAlertForm);
								}}
							>
								{t('common.cancel')}
							</DesktopAppButton>
						) : null}
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={isPending || !alertForm.title.trim()}
						>
							{isPending ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : null}
							{editingAlert
								? t('operationsView.alerts.submitSave')
								: t('operationsView.alerts.submitCreate')}
						</DesktopAppButton>
					</div>
				</form>
			</SectionPanel>
		</div>
	);
}
