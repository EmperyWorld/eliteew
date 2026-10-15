/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * IMC Research left list: filters, search, virtual/plain history rows, load-more.
 *
 * Invariants:
 * - VirtualVariableList kicks in above MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD.
 *
 * Related:
 * - ImcResearchView.tsx
 * - useImcResearchController.ts
 */

import { VirtualVariableList } from '@/components/shared/VirtualList';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import type { ImcResearchRunSummary } from '@/types/imc';
import { cn } from '@/utils/cn';
import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
	DesktopAppButton,
	DesktopAppErrorState,
	DESKTOP_APP_STYLE_CONTRACT,
} from '../../../Desktop/components/DesktopAppChrome';
import { EmptyProjectState } from '../../components/EmptyProjectState';
import { MarketingCabinetSelect } from '../../components/MarketingCabinetSelect';
import { SectionPanel } from '../../components/SectionPanel';
import {
	MARKETING_SECTION_LIST_FETCH_LIMIT,
	MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD,
} from '../../constants';
import { extractApiErrorMessage } from '../../utils';
import { IMC_CONTROL_CLASS, statusBadgeClass } from './imcResearchHelpers';
import type { ImcResearchController } from './useImcResearchController';

export function ImcResearchListPanel({ c }: { c: ImcResearchController }) {
	function renderImcHistoryRow(row: ImcResearchRunSummary) {
		const active = c.focusedEntityId === row.id;
		const fullTextStats =
			row.result_char_count != null && row.result_line_count != null
				? {
						chars: row.result_char_count,
						lines: row.result_line_count,
					}
				: null;
		return (
			<div
				data-marketing-entity-id={row.id}
				className={cn(
					'flex min-w-0 items-stretch gap-1 rounded-(--desktop-radius) border text-sm transition-colors',
					active
						? 'border-(--mc-accent-50) bg-(--mc-accent-10) ring-1 ring-(--mc-accent-30)/40'
						: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) hover:border-(--desktop-border-strong)'
				)}
			>
				<button
					type="button"
					className={cn(
						DESKTOP_INTERACTIVE.rowInteractive,
						'min-w-0 flex-1 px-3 py-3 text-left focus:outline-none'
					)}
					onClick={() => c.onSelectResearch(row.id)}
				>
					<div className="flex items-center justify-between gap-2">
						<span className="font-medium text-(--desktop-text-primary)">
							{row.display_name}
						</span>
						<span
							className={cn(
								'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
								statusBadgeClass(row.status)
							)}
						>
							{c.t(`imcView.runStatus.${row.status}`, {
								defaultValue: row.status,
							})}
						</span>
					</div>
					<p className={cn('mt-1 line-clamp-2', DESKTOP_TYPOGRAPHY.meta)}>
						{row.result_preview || row.type_key}
					</p>
					{fullTextStats ? (
						<p
							className={cn(
								'mt-0.5 text-(--desktop-text-dim)',
								DESKTOP_TYPOGRAPHY.meta
							)}
						>
							{c.t('imcView.listCardTextStats', {
								chars: fullTextStats.chars.toLocaleString(c.statLocale),
								lines: fullTextStats.lines.toLocaleString(c.statLocale),
							})}
						</p>
					) : null}
					{row.started_by_label ? (
						<p
							className={cn(
								'mt-0.5 text-(--desktop-text-muted)',
								DESKTOP_TYPOGRAPHY.meta
							)}
						>
							{c.t('imcView.startedBy')}: {row.started_by_label}
						</p>
					) : null}
				</button>
				{c.isProjectLead ? (
					<div className="flex shrink-0 items-center pr-1">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="shrink-0 text-[color-mix(in_srgb,rgb(239_68_68)_85%,var(--desktop-text-muted))]"
							disabled={c.deleteMutation.isPending}
							aria-label={c.t('imcView.deleteResearch')}
							onClick={() => c.handleDeleteResearch(row.id)}
						>
							<TrashIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					</div>
				) : null}
			</div>
		);
	}

	return (
		<SectionPanel
			title={c.t('imcView.listTitle')}
			description={c.t('imcView.listDescription')}
			className="min-h-0 min-w-0"
			actions={
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className="shrink-0"
					disabled={c.listQuery.isFetching}
					onClick={() => void c.listQuery.refetch()}
				>
					{c.listQuery.isFetching ? (
						<ArrowPathIcon
							className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					) : (
						c.t('imcView.refreshList')
					)}
				</DesktopAppButton>
			}
		>
			<div className="mb-4 flex flex-col gap-3">
				<div className="flex flex-wrap gap-3">
					<div className="flex min-w-40 flex-1 flex-col gap-1.5">
						<label
							htmlFor={c.filterStatusSelectId}
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.helperText,
								'font-medium uppercase tracking-wider'
							)}
						>
							{c.t('imcView.filterStatus')}
						</label>
						<MarketingCabinetSelect
							id={c.filterStatusSelectId}
							size="compact"
							value={c.listFilterStatus}
							onChange={c.setListFilterStatus}
							options={c.statusFilterOptions}
							className="normal-case tracking-normal"
						/>
					</div>
					<div className="flex min-w-40 flex-1 flex-col gap-1.5">
						<label
							htmlFor={c.filterTypeSelectId}
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.helperText,
								'font-medium uppercase tracking-wider'
							)}
						>
							{c.t('imcView.filterType')}
						</label>
						<MarketingCabinetSelect
							id={c.filterTypeSelectId}
							size="compact"
							value={c.listFilterTypeKey}
							onChange={c.setListFilterTypeKey}
							options={c.typeFilterOptions}
							className="normal-case tracking-normal"
						/>
					</div>
					<div className="flex min-w-40 flex-1 flex-col gap-1.5">
						<label
							htmlFor={c.filterSortSelectId}
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.helperText,
								'font-medium uppercase tracking-wider'
							)}
						>
							{c.t('imcView.listSortLabel')}
						</label>
						<MarketingCabinetSelect
							id={c.filterSortSelectId}
							size="compact"
							value={c.listSort}
							onChange={(v) => c.setListSort(v as 'newest' | 'oldest')}
							options={c.sortFilterOptions}
							className="normal-case tracking-normal"
						/>
					</div>
				</div>
				<div className="flex flex-wrap items-end gap-3">
					<label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">
						<span
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.helperText,
								'font-medium uppercase tracking-wider'
							)}
						>
							{c.t('imcView.listSearchLabel')}
						</span>
						<input
							id={c.listSearchInputId}
							type="search"
							autoComplete="off"
							className={`${IMC_CONTROL_CLASS} min-h-10 px-3 py-2 text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)`}
							value={c.listSearch}
							onChange={(e) => c.setListSearch(e.target.value)}
							placeholder={c.t('imcView.listSearchPlaceholder')}
						/>
					</label>
					<label
						htmlFor={c.listActiveOnlyId}
						className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-(--desktop-text-secondary)"
					>
						<input
							id={c.listActiveOnlyId}
							type="checkbox"
							className={c.checkboxControl}
							checked={c.listActiveOnly}
							onChange={(e) => c.setListActiveOnly(e.target.checked)}
						/>
						{c.t('imcView.listActiveOnly')}
					</label>
				</div>
				<p className={DESKTOP_TYPOGRAPHY.meta}>
					{c.t('imcView.listSummary', {
						visible: c.filteredSortedListItems.length,
						loaded: c.rawListItems.length,
						total: c.listTotal,
					})}
				</p>
			</div>
			<div
				className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1"
				aria-busy={c.listQuery.isLoading}
			>
				{c.listQuery.isError ? (
					<DesktopAppErrorState
						message={`${c.t('imcView.listErrorTitle')}: ${extractApiErrorMessage(c.listQuery.error, c.t('imcView.listErrorDefault'))}`}
						actionLabel={c.t('imcView.refreshList')}
						onAction={() => void c.listQuery.refetch()}
					/>
				) : c.listQuery.isLoading ? (
					<div
						className="flex flex-col items-center justify-center gap-2 py-12"
						role="status"
						aria-live="polite"
					>
						<ArrowPathIcon
							className="h-8 w-8 shrink-0 motion-safe:animate-spin motion-reduce:animate-none text-(--desktop-text-dim)"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</div>
				) : c.filteredSortedListItems.length === 0 ? (
					<EmptyProjectState
						title={
							c.rawListItems.length === 0
								? c.t('imcView.emptyListTitle')
								: c.t('imcView.listSearchEmptyTitle')
						}
						description={
							c.rawListItems.length === 0
								? c.t('imcView.emptyListDescription')
								: c.t('imcView.listSearchEmptyDescription')
						}
					/>
				) : c.filteredSortedListItems.length >
					MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
					<VirtualVariableList
						items={c.filteredSortedListItems}
						estimateSize={() => 112}
						getItemKey={(index) =>
							c.filteredSortedListItems[index]?.id ?? `imc-${index}`
						}
						height={420}
						overscanCount={8}
						className="rounded-(--desktop-radius)"
						renderItem={(row) => (
							<div className="pb-2">{renderImcHistoryRow(row)}</div>
						)}
					/>
				) : (
					c.filteredSortedListItems.map((row) => (
						<div key={row.id}>{renderImcHistoryRow(row)}</div>
					))
				)}
				{c.rawListItems.length > 0 &&
				c.rawListItems.length <
					Math.min(c.listTotal, MARKETING_SECTION_LIST_FETCH_LIMIT) ? (
					<div className="pt-2">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="w-full sm:w-auto"
							disabled={c.listQuery.isFetching}
							onClick={() =>
								c.setListLimit((n) =>
									Math.min(n + 40, MARKETING_SECTION_LIST_FETCH_LIMIT)
								)
							}
						>
							{c.listQuery.isFetching ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : null}
							{c.t('imcView.listLoadMore')}
						</DesktopAppButton>
					</div>
				) : null}
			</div>
		</SectionPanel>
	);
}
