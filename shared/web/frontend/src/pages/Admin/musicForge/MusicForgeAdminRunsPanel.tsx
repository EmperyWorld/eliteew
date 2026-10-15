/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin «Песни» panel — search, filters, rich table, drawer inspector.
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { log } from '../../../utils/logger';
import { AdminButton, AdminDrawer, AdminStatusBanner } from '../ui';
import { adminUiTableWrapClass } from '../ui/adminTokens';
import { adminUiMetaClass } from './musicForgeConfigEditorShared';
import { MusicForgeAdminRunProgressBar } from './MusicForgeAdminRunProgressBar';
import { MusicForgeAdminRunStatusBadge } from './MusicForgeAdminRunStatusBadge';
import {
	formatMusicForgeAdminDateTime,
	formatMusicForgeAdminDuration,
	formatMusicForgeAdminLanguageLabel,
	truncateTableCell,
	type MusicForgeAdminRunStatus,
} from './musicForgeAdminRunHelpers';
import {
	MusicForgeAdminRunsToolbar,
	type MusicForgeAdminRunsToolbarFilters,
} from './MusicForgeAdminRunsToolbar';
import { MusicForgeRunInspector } from './MusicForgeRunInspector';
import {
	type MusicForgeAdminRunRow,
	getMusicForgeAdminRuns,
} from './musicForgeAdminApi';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 320;

type StatusFilter = 'all' | MusicForgeAdminRunStatus;

const EMPTY_FILTERS: MusicForgeAdminRunsToolbarFilters = {
	q: '',
	modeKey: '',
	modelLane: '',
};

export function MusicForgeAdminRunsPanel(): React.ReactElement {
	const { t, i18n } = useTranslation('desktopUi');
	const [rows, setRows] = React.useState<MusicForgeAdminRunRow[]>([]);
	const [total, setTotal] = React.useState(0);
	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
	const [toolbarFilters, setToolbarFilters] =
		React.useState<MusicForgeAdminRunsToolbarFilters>(EMPTY_FILTERS);
	const [debouncedQ, setDebouncedQ] = React.useState('');
	const [offset, setOffset] = React.useState(0);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);

	React.useEffect(() => {
		const timer = window.setTimeout(() => {
			setDebouncedQ(toolbarFilters.q.trim());
		}, SEARCH_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [toolbarFilters.q]);

	const load = React.useCallback(
		async (nextOffset: number) => {
			setLoading(true);
			setError(null);
			try {
				const response = await getMusicForgeAdminRuns({
					limit: PAGE_SIZE,
					offset: nextOffset,
					status: statusFilter === 'all' ? undefined : statusFilter,
					q: debouncedQ || undefined,
					mode_key: toolbarFilters.modeKey.trim() || undefined,
					model_lane: toolbarFilters.modelLane.trim() || undefined,
				});
				setRows(response.items);
				setTotal(response.total);
				setOffset(response.offset);
			} catch (err) {
				log.error(
					'MusicForgeAdminRuns',
					'runs load failed',
					err instanceof Error ? err : undefined
				);
				setError(t('adminMusicForge.loadError'));
				setRows([]);
			} finally {
				setLoading(false);
			}
		},
		[
			t,
			debouncedQ,
			statusFilter,
			toolbarFilters.modeKey,
			toolbarFilters.modelLane,
		]
	);

	React.useEffect(() => {
		void load(0);
	}, [load]);

	const statusFilters = React.useMemo(
		(): { id: StatusFilter; label: string }[] => [
			{ id: 'all', label: t('adminMusicForge.songsFilterAll') },
			{ id: 'running', label: t('adminMusicForge.runStatus.running') },
			{ id: 'completed', label: t('adminMusicForge.runStatus.completed') },
			{ id: 'failed', label: t('adminMusicForge.runStatus.failed') },
			{ id: 'queued', label: t('adminMusicForge.runStatus.queued') },
			{ id: 'cancelled', label: t('adminMusicForge.runStatus.cancelled') },
		],
		[t]
	);

	const pageStart = total === 0 ? 0 : offset + 1;
	const pageEnd = Math.min(offset + rows.length, total);
	const canPrev = offset > 0;
	const canNext = offset + PAGE_SIZE < total;
	const hasActiveFilters = Boolean(
		debouncedQ ||
			toolbarFilters.modeKey.trim() ||
			toolbarFilters.modelLane.trim() ||
			statusFilter !== 'all'
	);

	const selectRun = (runId: string) => {
		setSelectedRunId(runId);
	};

	const clearToolbarFilters = () => {
		setToolbarFilters(EMPTY_FILTERS);
		setSelectedRunId(null);
	};

	return (
		<div className="space-y-4">
			<AdminStatusBanner tone="info">
				<p className="text-sm">{t('adminMusicForge.songsHero')}</p>
			</AdminStatusBanner>

			<MusicForgeAdminRunsToolbar
				filters={toolbarFilters}
				disabled={loading}
				onChange={(next) => {
					setToolbarFilters(next);
					setSelectedRunId(null);
				}}
				onClear={clearToolbarFilters}
			/>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<fieldset className="m-0 min-w-0 border-0 p-0">
					<legend className="sr-only">
						{t('adminMusicForge.songsFilterAria')}
					</legend>
					<div className="flex flex-wrap gap-2">
						{statusFilters.map((item) => (
							<AdminButton
								key={item.id}
								variant={statusFilter === item.id ? 'primary' : 'secondary'}
								className="py-1 text-xs"
								onClick={() => {
									setStatusFilter(item.id);
									setSelectedRunId(null);
								}}
							>
								{item.label}
							</AdminButton>
						))}
					</div>
				</fieldset>
				<AdminButton
					variant="secondary"
					onClick={() => void load(offset)}
					disabled={loading}
				>
					<ArrowPathIcon className="h-4 w-4" />
					{t('adminMusicForge.refresh')}
				</AdminButton>
			</div>

			<p className={adminUiMetaClass}>
				{t('adminMusicForge.songsTotal', { count: total })}
				{total > 0
					? ` · ${t('adminMusicForge.songsPageRange', {
							from: pageStart,
							to: pageEnd,
						})}`
					: null}
			</p>

			{error ? <p className="text-sm text-red-300">{error}</p> : null}
			{loading && rows.length === 0 ? (
				<p className={adminUiMetaClass}>{t('adminMusicForge.loading')}</p>
			) : null}
			{rows.length === 0 && !loading && !error ? (
				<p className={adminUiMetaClass}>
					{hasActiveFilters
						? t('adminMusicForge.songsEmptyFiltered')
						: t('adminMusicForge.runsEmpty')}
				</p>
			) : null}

			{rows.length > 0 ? (
				<div
					className={cn(
						adminUiTableWrapClass,
						loading && 'pointer-events-none opacity-70'
					)}
				>
					<table className="min-w-full border-collapse text-left text-[length:var(--admin-ui-text-sm)]">
						<thead>
							<tr className="border-b border-[var(--admin-ui-border)] text-[var(--admin-ui-fg-muted)]">
								<th scope="col" className="px-3 py-2 font-medium">
									{t('adminMusicForge.runsStatus')}
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									{t('adminMusicForge.runsIdea')}
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									{t('adminMusicForge.songsTrackColumn')}
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									{t('adminMusicForge.inspectorMode')}
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									{t('adminMusicForge.songsGenreColumn')}
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									{t('adminMusicForge.songsLanguageColumn')}
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									{t('adminMusicForge.runsDuration')}
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									{t('adminMusicForge.inspectorProgress')}
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									{t('adminMusicForge.runsCreated')}
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => {
								const showProgress =
									(row.status === 'running' || row.status === 'queued') &&
									typeof row.progress_total === 'number' &&
									row.progress_total > 0;
								return (
									<tr
										key={row.id}
										className={cn(
											'cursor-pointer border-b border-[var(--admin-ui-border)]/60 last:border-0',
											'hover:bg-[var(--admin-ui-accent-soft)]',
											selectedRunId === row.id &&
												'bg-[var(--admin-ui-accent-soft)]'
										)}
										onClick={() => selectRun(row.id)}
										onKeyDown={(event) => {
											if (event.key === 'Enter' || event.key === ' ') {
												event.preventDefault();
												selectRun(row.id);
											}
										}}
										tabIndex={0}
									>
										<td className="px-3 py-2">
											<MusicForgeAdminRunStatusBadge status={row.status} />
										</td>
										<td className="max-w-[14rem] truncate px-3 py-2 font-medium text-[var(--admin-ui-fg)]">
											{row.idea}
										</td>
										<td className="max-w-[10rem] truncate px-3 py-2 text-[var(--admin-ui-fg-muted)]">
											{truncateTableCell(row.result_track_name, 28)}
										</td>
										<td className="px-3 py-2 text-[var(--admin-ui-fg-muted)]">
											{row.mode_key ?? '—'}
										</td>
										<td className="max-w-[8rem] truncate px-3 py-2 text-[var(--admin-ui-fg-muted)]">
											{truncateTableCell(row.style_hint, 20)}
										</td>
										<td className="px-3 py-2 text-[var(--admin-ui-fg-muted)]">
											{formatMusicForgeAdminLanguageLabel(row.language, t)}
										</td>
										<td className="px-3 py-2 text-[var(--admin-ui-fg-muted)]">
											{formatMusicForgeAdminDuration(row.duration_seconds)}
										</td>
										<td className="min-w-[5.5rem] px-3 py-2">
											{showProgress ? (
												<MusicForgeAdminRunProgressBar
													current={row.progress_current ?? 0}
													total={row.progress_total ?? 0}
												/>
											) : (
												<span className="text-[var(--admin-ui-fg-dim)]">—</span>
											)}
										</td>
										<td className="whitespace-nowrap px-3 py-2 text-[var(--admin-ui-fg-muted)]">
											{formatMusicForgeAdminDateTime(
												row.created_at,
												i18n.language
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : null}

			{total > PAGE_SIZE ? (
				<div className="flex flex-wrap items-center justify-end gap-2">
					<AdminButton
						variant="secondary"
						disabled={!canPrev || loading}
						onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
					>
						{t('adminMusicForge.songsPrevPage')}
					</AdminButton>
					<AdminButton
						variant="secondary"
						disabled={!canNext || loading}
						onClick={() => void load(offset + PAGE_SIZE)}
					>
						{t('adminMusicForge.songsNextPage')}
					</AdminButton>
				</div>
			) : null}

			<AdminDrawer
				open={selectedRunId != null}
				title={t('adminMusicForge.inspectorTitle')}
				onClose={() => setSelectedRunId(null)}
				wide
			>
				{selectedRunId ? (
					<MusicForgeRunInspector
						runId={selectedRunId}
						embedded
						onClose={() => setSelectedRunId(null)}
					/>
				) : null}
			</AdminDrawer>
		</div>
	);
}
