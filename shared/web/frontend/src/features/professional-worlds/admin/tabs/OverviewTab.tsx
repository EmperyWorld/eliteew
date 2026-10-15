/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin overview cards plus quick navigation into high-traffic operator tabs for Professional Worlds.
 *
 * Invariants:
 * - Read-only snapshot display; navigation is delegated to parent `tablist` semantics.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/adminTabContract.ts
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	AdminButton,
	AdminJsonPreview,
	AdminStatusBanner,
	type AdminUiBannerTone,
} from '@/pages/Admin/ui';

import type { AdminTab } from '../adminTabContract';
import type { ProfessionalWorldsAdminSnapshot } from '../types';

function runtimeMetricTone(
	metric: 'failed' | 'runs' | 'artifacts' | 'credits',
	value: number
): AdminUiBannerTone {
	if (metric === 'failed' && value > 0) {
		return 'danger';
	}
	if (metric === 'credits' && value > 100) {
		return 'warning';
	}
	if (value > 0) {
		return 'success';
	}
	return 'info';
}

function MetricCard({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4">
			<h3 className="mb-3 text-sm font-semibold text-[var(--admin-ui-fg)]">
				{title}
			</h3>
			{children}
		</section>
	);
}

export function OverviewTab({
	snapshot,
	onNavigateTab,
}: {
	snapshot: ProfessionalWorldsAdminSnapshot;
	onNavigateTab: (tab: AdminTab) => void;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const runtime = snapshot.overview.runtime;

	const quickTabs: { id: AdminTab; labelKey: string }[] = [
		{ id: 'ops', labelKey: 'admin.overview.gotoOps' },
		{ id: 'integrations', labelKey: 'admin.overview.gotoIntegrations' },
		{ id: 'photo-presets', labelKey: 'admin.overview.gotoPhotoPresets' },
		{ id: 'packs', labelKey: 'admin.overview.gotoPacks' },
		{ id: 'rollouts', labelKey: 'admin.overview.gotoRollouts' },
		{ id: 'ai-actions', labelKey: 'admin.overview.gotoAiActions' },
		{ id: 'audit', labelKey: 'admin.overview.gotoAudit' },
	];

	return (
		<div className="grid gap-4">
			<div className="grid gap-4 md:grid-cols-5">
				{[
					[t('admin.overview.verticals'), snapshot.overview.verticals_count],
					[t('admin.overview.modules'), snapshot.overview.modules_count],
					[t('admin.overview.aiActions'), snapshot.overview.ai_actions_count],
					[t('admin.overview.photo'), snapshot.overview.photo_presets_count],
					[
						t('admin.overview.integrations'),
						snapshot.overview.enabled_integrations_count,
					],
				].map(([label, value]) => (
					<MetricCard key={String(label)} title={String(label)}>
						<strong className="text-3xl text-[var(--admin-ui-fg)]">
							{String(value)}
						</strong>
					</MetricCard>
				))}
				<MetricCard title={t('admin.overview.warnings')}>
					{(snapshot.overview.broken_bindings ?? []).length === 0 ? (
						<p className="text-sm text-[var(--admin-ui-fg-muted)]">
							{t('admin.overview.noBrokenBindings')}
						</p>
					) : (
						<AdminJsonPreview value={snapshot.overview.broken_bindings ?? []} />
					)}
				</MetricCard>
			</div>

			<div className="grid gap-4 md:grid-cols-4">
				{[
					[
						t('admin.overview.packVersions'),
						snapshot.overview.pack_versions_count ?? 0,
					],
					[
						t('admin.overview.publishedReleases'),
						snapshot.overview.published_releases_count ?? 0,
					],
					[
						t('admin.overview.activeRollouts'),
						snapshot.overview.active_rollouts_count ?? 0,
					],
					[
						t('admin.overview.packReleases'),
						snapshot.overview.pack_releases_count ?? 0,
					],
				].map(([label, value]) => (
					<MetricCard key={String(label)} title={String(label)}>
						<strong className="text-3xl text-[var(--admin-ui-fg)]">
							{String(value)}
						</strong>
					</MetricCard>
				))}
			</div>

			{runtime ? (
				<div className="grid gap-4 md:grid-cols-4">
					{(
						[
							[
								'runs',
								t('admin.overview.runtimeRuns24h'),
								runtime.playbook_runs_24h,
							],
							[
								'failed',
								t('admin.overview.runtimeFailed24h'),
								runtime.playbook_runs_failed_24h,
							],
							[
								'artifacts',
								t('admin.overview.runtimeArtifacts24h'),
								runtime.artifacts_24h,
							],
							[
								'credits',
								t('admin.overview.runtimeCredits24h'),
								runtime.credits_used_24h,
							],
						] as const
					).map(([metric, label, value]) => (
						<MetricCard key={metric} title={label}>
							<AdminStatusBanner
								tone={runtimeMetricTone(metric, Number(value))}
							>
								<strong className="text-2xl">{String(value)}</strong>
							</AdminStatusBanner>
						</MetricCard>
					))}
				</div>
			) : (
				<AdminStatusBanner tone="warning">
					{t('admin.overview.runtimeUnavailable')}
				</AdminStatusBanner>
			)}

			<section className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4">
				<h3 className="mb-3 text-sm font-semibold text-[var(--admin-ui-fg)]">
					{t('admin.overview.quickLinksTitle')}
				</h3>
				<div className="flex flex-wrap gap-2">
					{quickTabs.map((entry) => (
						<AdminButton
							key={entry.id}
							variant="secondary"
							onClick={() => onNavigateTab(entry.id)}
						>
							{t(entry.labelKey)}
						</AdminButton>
					))}
				</div>
				<p className="mt-3 text-xs text-[var(--admin-ui-fg-muted)]">
					{t('admin.overview.docsRepoHint')}
				</p>
			</section>
		</div>
	);
}
