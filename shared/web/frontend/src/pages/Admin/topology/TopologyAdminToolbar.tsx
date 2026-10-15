/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KPI row, search, band filters, legend, and map actions for Admin Topology.
 *
 * Related:
 * - TopologyAdminSection.tsx
 * - topologyAdminHelpers.ts
 */

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { AdminButton } from '../ui';
import { adminUiFieldClass } from '../ui/adminTokens';
import type { TopologyGraphResponse } from './topologyApi';
import {
	adminUiMetaClass,
	collectBandsPresent,
	formatProbedAt,
	TOPOLOGY_BAND_META,
	type TopologyViewFilters,
} from './topologyAdminHelpers';

export interface TopologyAdminToolbarProps {
	graph: TopologyGraphResponse | null;
	filters: TopologyViewFilters;
	onFiltersChange: (next: TopologyViewFilters) => void;
	visibleNodeCount: number;
	loading: boolean;
	onFitView: () => void;
	onResetLayout: () => void;
	onRefresh: () => void;
	canResetLayout: boolean;
	canFitView: boolean;
}

function KpiCard({
	label,
	value,
	hint,
	accent,
}: {
	label: string;
	value: string | number;
	hint?: string;
	accent?: string;
}): React.ReactElement {
	return (
		<div className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-3">
			<p className="text-[10px] font-medium uppercase tracking-wider text-[var(--admin-ui-fg-dim)]">
				{label}
			</p>
			<p
				className="mt-1 text-2xl font-semibold tabular-nums text-[var(--admin-ui-fg)]"
				style={accent ? { color: accent } : undefined}
			>
				{value}
			</p>
			{hint ? <p className={`mt-1 ${adminUiMetaClass}`}>{hint}</p> : null}
		</div>
	);
}

export function TopologyAdminToolbar({
	graph,
	filters,
	onFiltersChange,
	visibleNodeCount,
	loading,
	onFitView,
	onResetLayout,
	onRefresh,
	canResetLayout,
	canFitView,
}: TopologyAdminToolbarProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const searchId = useId();
	const bandsPresent = graph ? collectBandsPresent(graph.nodes) : [];

	const toggleBand = (bandId: string) => {
		const next = new Set(filters.bands);
		if (next.has(bandId)) {
			next.delete(bandId);
		} else {
			next.add(bandId);
		}
		onFiltersChange({ ...filters, bands: next });
	};

	return (
		<div className="space-y-4">
			{graph ? (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					<KpiCard
						label={t('adminTopology.kpiNodes', 'Nodes')}
						value={visibleNodeCount}
						hint={t('adminTopology.kpiNodesHint', {
							total: graph.counts.nodes,
							defaultValue: `of ${graph.counts.nodes} in catalog`,
						})}
					/>
					<KpiCard
						label={t('adminTopology.kpiDeps', 'Dependencies')}
						value={graph.counts.dependency_edges}
					/>
					<KpiCard
						label={t('adminTopology.kpiEvents', 'Event flows')}
						value={graph.counts.event_edges}
					/>
					<KpiCard
						label={t('adminTopology.kpiFactory', 'Factory')}
						value={graph.counts.factory_active ?? 0}
						hint={t('adminTopology.kpiFactoryHint', {
							touched: graph.counts.factory_touched_nodes ?? 0,
							defaultValue: `${graph.counts.factory_touched_nodes ?? 0} nodes touched`,
						})}
						accent={
							(graph.counts.factory_active ?? 0) > 0
								? 'var(--admin-ui-status-info)'
								: undefined
						}
					/>
					<KpiCard
						label={t('adminTopology.kpiProbed', 'Last probe')}
						value={formatProbedAt(graph.probed_at).split(',')[0] ?? '—'}
						hint={`${formatProbedAt(graph.probed_at)} · ${t('adminTopology.autoRefresh')}`}
					/>
				</div>
			) : null}

			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
					<div className="min-w-[200px] flex-1 sm:max-w-xs">
						<label htmlFor={searchId} className={adminUiMetaClass}>
							{t('adminTopology.searchLabel', 'Search services')}
						</label>
						<div className="relative mt-1">
							<MagnifyingGlassIcon
								className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-ui-fg-dim)]"
								aria-hidden
							/>
							<input
								id={searchId}
								type="search"
								value={filters.query}
								onChange={(e) =>
									onFiltersChange({ ...filters, query: e.target.value })
								}
								placeholder={t(
									'adminTopology.searchPlaceholder',
									'Name, id, role, feature…'
								)}
								className={cn(adminUiFieldClass, 'pl-9')}
							/>
						</div>
					</div>

					{bandsPresent.length > 0 ? (
						<fieldset className="min-w-0 border-0 p-0">
							<legend className={adminUiMetaClass}>
								{t('adminTopology.bandFilter', 'Bands')}
							</legend>
							<div className="mt-1 flex flex-wrap gap-1.5">
								{TOPOLOGY_BAND_META.filter((b) =>
									bandsPresent.includes(b.id)
								).map((band) => {
									const active =
										filters.bands.size === 0 || filters.bands.has(band.id);
									const selected = filters.bands.has(band.id);
									return (
										<button
											key={band.id}
											type="button"
											onClick={() => toggleBand(band.id)}
											className={cn(
												'rounded-[var(--admin-ui-radius-sm)] border px-2.5 py-1 text-[11px] font-medium transition-colors',
												selected
													? 'border-[var(--admin-ui-accent)] bg-[var(--admin-ui-accent-soft)] text-[var(--admin-ui-fg)]'
													: active
														? 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg-muted)] hover:border-[var(--admin-ui-accent)]/50'
														: 'border-[var(--admin-ui-border)]/60 bg-transparent text-[var(--admin-ui-fg-dim)] opacity-60'
											)}
											style={
												selected
													? { boxShadow: `inset 0 0 0 1px ${band.accent}44` }
													: undefined
											}
										>
											{t(band.labelKey, band.id)}
										</button>
									);
								})}
								{filters.bands.size > 0 ? (
									<button
										type="button"
										onClick={() =>
											onFiltersChange({ ...filters, bands: new Set() })
										}
										className="rounded-[var(--admin-ui-radius-sm)] px-2 py-1 text-[11px] text-[var(--admin-ui-fg-muted)] underline-offset-2 hover:underline"
									>
										{t('adminTopology.bandClear', 'All bands')}
									</button>
								) : null}
							</div>
						</fieldset>
					) : null}

					<label className="flex cursor-pointer items-center gap-2 pb-1">
						<input
							type="checkbox"
							checked={filters.showDependencies}
							onChange={(e) =>
								onFiltersChange({
									...filters,
									showDependencies: e.target.checked,
								})
							}
							className="rounded border-[var(--admin-ui-border)]"
						/>
						<span className="text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
							{t('adminTopology.showDependencies', 'Show dependencies')}
						</span>
					</label>

					<label className="flex cursor-pointer items-center gap-2 pb-1">
						<input
							type="checkbox"
							checked={filters.showEvents}
							onChange={(e) =>
								onFiltersChange({
									...filters,
									showEvents: e.target.checked,
								})
							}
							className="rounded border-[var(--admin-ui-border)]"
						/>
						<span className="text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
							{t('adminTopology.showEvents', 'Show event flows')}
						</span>
					</label>

					<label className="flex cursor-pointer items-center gap-2 pb-1">
						<input
							type="checkbox"
							checked={filters.factoryOnly}
							onChange={(e) =>
								onFiltersChange({
									...filters,
									factoryOnly: e.target.checked,
								})
							}
							className="rounded border-[var(--admin-ui-border)]"
						/>
						<span className="text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
							{t('adminTopology.factoryOnly', 'Factory nodes only')}
						</span>
					</label>
				</div>

				<div className="flex flex-wrap gap-2">
					<AdminButton
						variant="ghost"
						onClick={onFitView}
						disabled={!canFitView}
					>
						{t('adminTopology.fitView', 'Fit view')}
					</AdminButton>
					<AdminButton
						variant="ghost"
						onClick={onResetLayout}
						disabled={!canResetLayout}
					>
						{t('adminTopology.resetLayout', 'Reset layout')}
					</AdminButton>
					<AdminButton
						variant="secondary"
						onClick={onRefresh}
						disabled={loading}
					>
						{loading
							? t('adminTopology.refreshing', 'Refreshing…')
							: t('adminTopology.refresh', 'Refresh')}
					</AdminButton>
				</div>
			</div>

			<section
				className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)]/70 bg-[var(--admin-ui-surface)]/60 px-3 py-2"
				aria-labelledby="topology-legend-heading"
			>
				<span
					id="topology-legend-heading"
					className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-ui-fg-dim)]"
				>
					{t('adminTopology.legendAria')}
				</span>
				<span className="inline-flex items-center gap-2 text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
					<span
						className="inline-block h-0.5 w-8 rounded-full bg-[var(--admin-ui-fg)]"
						aria-hidden
					/>
					{t('adminTopology.legendDep')}
				</span>
				<span className="inline-flex items-center gap-2 text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
					<span
						className="inline-block h-0 w-8 border-t-2 border-dashed border-[var(--admin-ui-fg-dim)]"
						aria-hidden
					/>
					{t('adminTopology.legendEvent')}
				</span>
				<span className="text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
					{t('adminTopology.legendHealth')}
				</span>
				<span className="inline-flex items-center gap-1.5 text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
					<span
						className="inline-block h-3 w-3 rounded-sm border border-[var(--admin-ui-status-info)] ring-2 ring-[var(--admin-ui-status-info)]/30"
						aria-hidden
					/>
					{t('adminTopology.legendFactory')}
				</span>
			</section>
		</div>
	);
}
