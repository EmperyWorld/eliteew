/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Admin v2 overview: quick health counters and first-level validation issues.
 *
 * Invariants:
 * - Overview must not mutate state; it only summarizes snapshot and offers safe bulk entry points.
 *
 * Related:
 * - src/features/ugs/admin-v2/UGSAdminV2PanelBody.tsx
 */

import {
	CpuChipIcon,
	ExclamationTriangleIcon,
	SignalIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { UgsMetricCard } from '@/components/UGS/workspace/UgsMetricCard';
import {
	UGS_DESKTOP_BTN,
	UGS_SEVERITY_BADGE,
	ugsAdminOverviewCardClass,
} from '@/features/ugs/shared/ugsDesktopUi';
import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { UGS_ADMIN_V2_NS } from '@/i18n/namespaces';
import type {
	UgsAdminV2BulkOperation,
	UgsAdminV2SnapshotDTO,
} from '@/services/api/ugsAdminV2';
import { cn } from '@/utils/cn';

function countActive(items: Array<{ enabled?: boolean; is_active?: boolean }>) {
	return items.filter((i) =>
		typeof i.enabled === 'boolean'
			? i.enabled
			: typeof i.is_active === 'boolean'
				? i.is_active
				: false
	).length;
}

export function OverviewTabV2({
	snapshot,
	onRequestBulk,
	onBootstrapRuntime,
	bootstrapPending = false,
}: {
	snapshot: UgsAdminV2SnapshotDTO;
	onRequestBulk: (ops: UgsAdminV2BulkOperation[]) => void | Promise<void>;
	onBootstrapRuntime?: () => void | Promise<void>;
	bootstrapPending?: boolean;
}): React.ReactElement {
	const { t } = useTranslation(UGS_ADMIN_V2_NS);
	const theme = useDesktopShellTheme();
	const activeProviders = countActive(snapshot.providers);
	const activeTypes = countActive(snapshot.types);
	const activeWorkflows = countActive(snapshot.workflows);
	const errors = snapshot.issues.filter((i) => i.severity === 'error').length;
	const warnings = snapshot.issues.filter(
		(i) => i.severity === 'warning'
	).length;
	const issuesSummary =
		errors > 0
			? t('overview.errorsCount', { count: errors })
			: t('overview.zeroErrors');
	const issuesHint = warnings
		? t('overview.warningsCount', { count: warnings })
		: undefined;

	return (
		<div className="space-y-4">
			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<UgsMetricCard
					theme={theme}
					label={t('overview.providersActiveTotal')}
					value={`${activeProviders} / ${snapshot.providers.length}`}
					icon={SignalIcon}
					accent={
						activeProviders < snapshot.providers.length ? 'warning' : 'success'
					}
				/>
				<UgsMetricCard
					theme={theme}
					label={t('overview.typesActiveTotal')}
					value={`${activeTypes} / ${snapshot.types.length}`}
					icon={Squares2X2Icon}
					accent={activeTypes < snapshot.types.length ? 'warning' : 'success'}
				/>
				<UgsMetricCard
					theme={theme}
					label={t('overview.workflowsActiveTotal')}
					value={`${activeWorkflows} / ${snapshot.workflows.length}`}
					icon={CpuChipIcon}
					accent={
						activeWorkflows < snapshot.workflows.length ? 'warning' : 'success'
					}
				/>
				<UgsMetricCard
					theme={theme}
					label={t('overview.issues')}
					value={issuesSummary}
					hint={issuesHint}
					icon={ExclamationTriangleIcon}
					accent={errors > 0 ? 'danger' : warnings > 0 ? 'warning' : 'success'}
				/>
			</section>

			<div className="grid gap-4 lg:grid-cols-2">
				<div className={ugsAdminOverviewCardClass}>
					<h2 className="text-lg font-semibold text-(--desktop-text-primary)">
						{t('overview.quickActionsTitle')}
					</h2>
					<p className="mt-2 text-sm text-(--desktop-text-muted)">
						{t('overview.quickActionsHint')}
					</p>
					<div className="mt-4 flex flex-wrap gap-3">
						<button
							type="button"
							className={UGS_DESKTOP_BTN.primary}
							onClick={() =>
								void onRequestBulk([
									{
										kind: 'provider.set_enabled',
										provider_names: snapshot.providers.map(
											(p) => p.provider_name
										),
										enabled: true,
									},
								])
							}
						>
							{t('overview.enableAllProviders')}
						</button>
						<button
							type="button"
							className={UGS_DESKTOP_BTN.secondary}
							onClick={() =>
								void onRequestBulk([
									{
										kind: 'type.set_active',
										type_keys: snapshot.types.map(
											(typeRow) => typeRow.type_key
										),
										is_active: true,
									},
								])
							}
						>
							{t('overview.activateAllTypes')}
						</button>
						<button
							type="button"
							className={UGS_DESKTOP_BTN.secondary}
							onClick={() => void onBootstrapRuntime?.()}
							disabled={bootstrapPending || !onBootstrapRuntime}
						>
							{t('overview.bootstrapRuntimeProviders')}
						</button>
					</div>
				</div>

				<div className={ugsAdminOverviewCardClass}>
					<h2 className="text-lg font-semibold text-(--desktop-text-primary)">
						{t('overview.summaryTitle')}
					</h2>
					<ul className="mt-4 space-y-2 text-sm text-(--desktop-text-secondary)">
						<li className="flex justify-between gap-3 border-b border-(--desktop-border-subtle) pb-2">
							<span>{t('overview.providersActiveTotal')}</span>
							<span className="font-semibold tabular-nums text-(--desktop-text-primary)">
								{activeProviders} / {snapshot.providers.length}
							</span>
						</li>
						<li className="flex justify-between gap-3 border-b border-(--desktop-border-subtle) pb-2">
							<span>{t('overview.typesActiveTotal')}</span>
							<span className="font-semibold tabular-nums text-(--desktop-text-primary)">
								{activeTypes} / {snapshot.types.length}
							</span>
						</li>
						<li className="flex justify-between gap-3">
							<span>{t('overview.workflowsActiveTotal')}</span>
							<span className="font-semibold tabular-nums text-(--desktop-text-primary)">
								{activeWorkflows} / {snapshot.workflows.length}
							</span>
						</li>
					</ul>
				</div>
			</div>

			<div className={cn(ugsAdminOverviewCardClass, 'lg:col-span-2')}>
				<h2 className="text-lg font-semibold text-(--desktop-text-primary)">
					{t('overview.configValidationTitle')}
				</h2>
				{snapshot.issues.length ? (
					<div className="mt-4 grid gap-2">
						{snapshot.issues.slice(0, 12).map((it) => (
							<div
								key={`${it.entity_type}:${it.entity_id}:${it.field}:${it.message}`}
								className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/60 p-4 text-sm"
							>
								<div className="flex flex-wrap items-center gap-2">
									<span
										className={
											it.severity === 'error'
												? UGS_SEVERITY_BADGE.error
												: it.severity === 'warning'
													? UGS_SEVERITY_BADGE.warning
													: UGS_SEVERITY_BADGE.info
										}
									>
										{it.severity}
									</span>
									<span className="text-(--desktop-text-secondary)">
										{it.entity_type}:{it.entity_id}
									</span>
									{it.field ? (
										<span className="text-(--desktop-text-muted)">
											· {it.field}
										</span>
									) : null}
								</div>
								<div className="mt-1 text-(--desktop-text-secondary)">
									{it.message}
								</div>
							</div>
						))}
						{snapshot.issues.length > 12 ? (
							<p className="text-xs text-(--desktop-text-muted)">
								{t('overview.issuesTruncated', {
									total: snapshot.issues.length,
								})}
							</p>
						) : null}
					</div>
				) : (
					<p className="mt-3 text-sm text-(--desktop-text-muted)">
						{t('common.noIssuesFound')}
					</p>
				)}
			</div>
		</div>
	);
}
