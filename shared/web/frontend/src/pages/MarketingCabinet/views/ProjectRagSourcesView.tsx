/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Страница маркетингового кабинета: источники RAG проекта и семантический поиск по Qdrant.
 *
 * Invariants:
 * - Запросы к API только при выбранном проекте; лимит семантических хитов в запросе (сейчас **16**, max 32 на бэке).
 *
 * Related:
 * - marketingProjectRagApi
 */
import {
	useMarketingProjectRagSources,
	usePatchMarketingRagSource,
} from '@/hooks/api/useMarketingProjectRag';
import {
	marketingProjectRagApi,
	type MarketingRagSourceItem,
} from '@/services/api/marketingProjectRagApi';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { useMutation } from '@tanstack/react-query';
import {
	ArrowPathIcon,
	MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { VirtualVariableList } from '@/components/shared/VirtualList';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppInput,
} from '../../Desktop/components/DesktopAppChrome';
import { EmptyProjectState } from '../components/EmptyProjectState';
import { SectionPanel } from '../components/SectionPanel';
import {
	MARKETING_RAG_CATALOG_ROW_ESTIMATE_PX,
	MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD,
	TEXTAREA_CLASS,
} from '../constants';
import { extractApiErrorMessage } from '../utils';

function sourceKindLabel(
	kind: string,
	t: (k: string, opts?: { defaultValue?: string }) => string
): string {
	if (kind === 'imc_research_run') {
		return t('projectRagView.sourceKindImc');
	}
	return t('projectRagView.sourceKindFile');
}

function itemMatchesQuery(
	row: MarketingRagSourceItem,
	q: string,
	t: (k: string, opts?: { defaultValue?: string }) => string
): boolean {
	const needle = q.trim().toLowerCase();
	if (!needle) return true;
	const kindLabel = sourceKindLabel(row.source_kind, t).toLowerCase();
	const hay = [
		row.name,
		row.content_id,
		row.mime_type,
		row.content_type,
		row.source_kind,
		row.imc_research_run_id,
		kindLabel,
	]
		.filter((x): x is string => typeof x === 'string' && x.length > 0)
		.map((s) => s.toLowerCase());
	return hay.some((s) => s.includes(needle));
}

function formatSimilarity(score: number | null | undefined): string | null {
	if (score == null || Number.isNaN(score)) {
		return null;
	}
	const pct = Math.round(score * 1000) / 10;
	return `${pct}%`;
}

export function ProjectRagSourcesView({
	selectedProjectId,
}: {
	selectedProjectId: string | null;
}) {
	const { t } = useTranslation('marketing');
	const catalogSearchFieldId = useId();
	const listQuery = useMarketingProjectRagSources(
		selectedProjectId ?? undefined
	);
	const patchMutation = usePatchMarketingRagSource(
		selectedProjectId ?? undefined
	);
	const [catalogFilter, setCatalogFilter] = useState('');
	const [semanticQuery, setSemanticQuery] = useState('');

	const semanticMutation = useMutation({
		mutationFn: async () => {
			if (!selectedProjectId) {
				throw new Error('no_project');
			}
			const q = semanticQuery.trim();
			return marketingProjectRagApi.semanticSearch(selectedProjectId, {
				q,
				limit: 16,
			});
		},
	});

	useEffect(() => {
		setCatalogFilter('');
		setSemanticQuery('');
		semanticMutation.reset();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- только смена проекта
	}, [semanticMutation.reset]);

	const allItems = listQuery.data?.items ?? [];
	const filteredItems = useMemo(
		() => allItems.filter((row) => itemMatchesQuery(row, catalogFilter, t)),
		[allItems, catalogFilter, t]
	);

	const runSemanticSearch = () => {
		const q = semanticQuery.trim();
		if (q.length < 2) return;
		semanticMutation.mutate();
	};

	const renderCatalogRow = useCallback(
		(row: MarketingRagSourceItem) => (
			<div className="grid grid-cols-1 gap-2 border-b border-(--desktop-border-subtle)/80 px-3 py-2.5 text-sm sm:grid-cols-[1.2fr_0.7fr_0.7fr_0.6fr_auto] sm:items-center sm:gap-3">
				<div className="min-w-0">
					<span className="line-clamp-2 font-medium text-(--desktop-text-primary)">
						{row.name || row.content_id.slice(0, 8)}
					</span>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'mt-0.5 font-mono text-[11px]'
						)}
					>
						{row.content_id}
					</p>
				</div>
				<div className="text-(--desktop-text-secondary)">
					{sourceKindLabel(row.source_kind, t)}
				</div>
				<div className="text-(--desktop-text-secondary)">
					{row.mime_type || '—'}
				</div>
				<div>
					<span
						className={cn(
							'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
							row.marketing_rag_included
								? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/35'
								: 'bg-(--desktop-text-dim)/15 text-(--desktop-text-muted) ring-(--desktop-border-subtle)'
						)}
					>
						{row.marketing_rag_included
							? t('projectRagView.inRagYes')
							: t('projectRagView.inRagNo')}
					</span>
				</div>
				<div className="sm:text-right">
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						disabled={patchMutation.isPending}
						onClick={() =>
							patchMutation.mutate({
								contentId: row.content_id,
								body: {
									marketing_rag_included: !row.marketing_rag_included,
								},
							})
						}
					>
						{row.marketing_rag_included
							? t('projectRagView.actionExclude')
							: t('projectRagView.actionInclude')}
					</DesktopAppButton>
				</div>
			</div>
		),
		[patchMutation, t]
	);

	if (!selectedProjectId) {
		return (
			<EmptyProjectState
				title={t('projectRagView.needProjectTitle')}
				description={t('projectRagView.needProjectDescription')}
			/>
		);
	}

	const listErrMsg = listQuery.isError
		? extractApiErrorMessage(
				listQuery.error,
				t('projectRagView.loadErrorDefault')
			)
		: null;

	const semanticErr =
		semanticMutation.isError &&
		extractApiErrorMessage(
			semanticMutation.error,
			t('projectRagView.semanticError')
		);

	return (
		<div className="flex min-h-0 flex-col gap-4">
			<SectionPanel
				title={t('projectRagView.semanticSectionTitle')}
				description={t('projectRagView.semanticSectionDescription')}
			>
				<div className="flex flex-col gap-3">
					<label className="grid gap-2 text-sm">
						<span className="text-(--desktop-text-muted)">
							{t('projectRagView.semanticAria')}
						</span>
						<textarea
							className={cn(
								TEXTAREA_CLASS,
								'min-h-[88px] disabled:cursor-not-allowed disabled:opacity-60'
							)}
							value={semanticQuery}
							onChange={(e) => setSemanticQuery(e.target.value)}
							placeholder={t('projectRagView.semanticPlaceholder')}
							rows={3}
							autoComplete="off"
							aria-label={t('projectRagView.semanticAria')}
						/>
					</label>
					<div className="flex flex-wrap items-center gap-2">
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="gap-1.5"
							disabled={
								semanticMutation.isPending || semanticQuery.trim().length < 2
							}
							onClick={() => runSemanticSearch()}
						>
							{semanticMutation.isPending ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : (
								<MagnifyingGlassIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							)}
							{t('projectRagView.semanticSubmit')}
						</DesktopAppButton>
						{semanticQuery.trim().length > 0 &&
						semanticQuery.trim().length < 2 ? (
							<span className={DESKTOP_TYPOGRAPHY.meta}>
								{t('projectRagView.semanticEmpty')}
							</span>
						) : null}
					</div>
					{semanticErr ? (
						<p className="text-sm text-red-300/90">{semanticErr}</p>
					) : null}
					{semanticMutation.isSuccess &&
					!semanticMutation.isPending &&
					!semanticMutation.data?.hits.length ? (
						<DesktopAppEmptyState
							title={t('projectRagView.semanticNoHits')}
							className="py-6"
						/>
					) : null}
					{semanticMutation.data?.hits.length ? (
						<ul className="flex max-h-[min(50vh,28rem)] flex-col gap-3 overflow-y-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 p-3">
							{semanticMutation.data.hits.map((hit) => {
								const sim = formatSimilarity(hit.score);
								return (
									<li
										key={`${hit.content_id ?? 'x'}_${hit.chunk_index ?? hit.ordinal}`}
										className="rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-elevated) p-3 text-sm"
									>
										<div
											className={cn(
												'mb-2 flex flex-wrap items-center gap-2',
												DESKTOP_TYPOGRAPHY.meta
											)}
										>
											<span className="font-medium text-(--desktop-text-secondary)">
												{t('projectRagView.semanticChunk', {
													ordinal: hit.ordinal,
												})}
											</span>
											{hit.source_label ? (
												<span className="truncate text-(--desktop-text-muted)">
													{hit.source_label}
												</span>
											) : null}
											{hit.content_id ? (
												<span className="font-mono text-[11px] text-(--desktop-text-dim)">
													{hit.content_id}
												</span>
											) : null}
											{sim ? (
												<span className="rounded-full bg-(--mc-accent-10) px-2 py-0.5 text-(--desktop-text-secondary) ring-1 ring-(--mc-accent-30)/50">
													{t('projectRagView.semanticScore', { score: sim })}
												</span>
											) : null}
										</div>
										<p className="whitespace-pre-wrap text-(--desktop-text-primary)">
											{hit.text}
										</p>
									</li>
								);
							})}
						</ul>
					) : null}
				</div>
			</SectionPanel>

			<SectionPanel
				title={t('projectRagView.catalogSectionTitle')}
				description={t('projectRagView.catalogSectionDescription')}
			>
				{listErrMsg ? (
					<DesktopAppErrorState
						message={listErrMsg}
						actionLabel={t('projectRagView.retry')}
						onAction={() => void listQuery.refetch()}
					/>
				) : listQuery.isLoading ? (
					<div
						className="flex justify-center py-12"
						role="status"
						aria-live="polite"
					>
						<ArrowPathIcon
							className="h-8 w-8 motion-safe:animate-spin motion-reduce:animate-none text-(--desktop-text-dim)"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</div>
				) : !allItems.length ? (
					<DesktopAppEmptyState
						title={t('projectRagView.emptyTitle')}
						description={t('projectRagView.emptyDescription')}
					/>
				) : (
					<div className="flex flex-col gap-3">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<label
								className="relative block min-w-0 flex-1 sm:max-w-md"
								htmlFor={catalogSearchFieldId}
							>
								<span className="sr-only">
									{t('projectRagView.searchAria')}
								</span>
								<MagnifyingGlassIcon
									className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--desktop-text-dim)"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								<DesktopAppInput
									id={catalogSearchFieldId}
									type="search"
									value={catalogFilter}
									onChange={(e) => setCatalogFilter(e.target.value)}
									placeholder={t('projectRagView.searchPlaceholder')}
									autoComplete="off"
									aria-label={t('projectRagView.searchAria')}
									className="w-full py-2.5 pl-9 pr-3"
								/>
							</label>
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'shrink-0 text-(--desktop-text-muted)'
								)}
							>
								{t('projectRagView.searchSummary', {
									shown: filteredItems.length,
									total: allItems.length,
								})}
							</p>
						</div>
						{!filteredItems.length ? (
							<DesktopAppEmptyState
								title={t('projectRagView.noSearchResultsTitle')}
								description={t('projectRagView.noSearchResultsDescription')}
							>
								{catalogFilter.trim() ? (
									<DesktopAppButton
										type="button"
										variant="neutral"
										size="sm"
										onClick={() => setCatalogFilter('')}
									>
										{t('projectRagView.clearSearch')}
									</DesktopAppButton>
								) : null}
							</DesktopAppEmptyState>
						) : filteredItems.length >
							MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
							<div className="overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle)">
								<div className="hidden border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 px-3 py-2.5 text-xs font-medium text-(--desktop-text-muted) sm:grid sm:grid-cols-[1.2fr_0.7fr_0.7fr_0.6fr_auto] sm:gap-3">
									<span>{t('projectRagView.colName')}</span>
									<span>{t('projectRagView.colKind')}</span>
									<span>{t('projectRagView.colMime')}</span>
									<span>{t('projectRagView.colRag')}</span>
									<span className="text-right">
										{t('projectRagView.colActions')}
									</span>
								</div>
								<VirtualVariableList
									items={filteredItems}
									estimateSize={() => MARKETING_RAG_CATALOG_ROW_ESTIMATE_PX}
									getItemKey={(index) =>
										filteredItems[index]?.content_id ?? `rag-${index}`
									}
									height={480}
									overscanCount={6}
									className="rounded-(--desktop-radius)"
									renderItem={(row) => renderCatalogRow(row)}
								/>
							</div>
						) : (
							<div className="overflow-x-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle)">
								<table className="w-full min-w-176 border-collapse text-left text-sm">
									<thead>
										<tr className="border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50">
											<th className="px-3 py-2.5 font-medium text-(--desktop-text-muted)">
												{t('projectRagView.colName')}
											</th>
											<th className="px-3 py-2.5 font-medium text-(--desktop-text-muted)">
												{t('projectRagView.colKind')}
											</th>
											<th className="px-3 py-2.5 font-medium text-(--desktop-text-muted)">
												{t('projectRagView.colMime')}
											</th>
											<th className="px-3 py-2.5 font-medium text-(--desktop-text-muted)">
												{t('projectRagView.colRag')}
											</th>
											<th className="px-3 py-2.5 text-right font-medium text-(--desktop-text-muted)">
												{t('projectRagView.colActions')}
											</th>
										</tr>
									</thead>
									<tbody>
										{filteredItems.map((row) => (
											<tr
												key={row.content_id}
												className="border-b border-(--desktop-border-subtle)/80"
											>
												<td className="max-w-56 px-3 py-2">
													<span className="line-clamp-2 font-medium text-(--desktop-text-primary)">
														{row.name || row.content_id.slice(0, 8)}
													</span>
													<p
														className={cn(
															DESKTOP_TYPOGRAPHY.meta,
															'mt-0.5 font-mono text-[11px]'
														)}
													>
														{row.content_id}
													</p>
												</td>
												<td className="whitespace-nowrap px-3 py-2 text-(--desktop-text-secondary)">
													{sourceKindLabel(row.source_kind, t)}
												</td>
												<td className="px-3 py-2 text-(--desktop-text-secondary)">
													{row.mime_type || '—'}
												</td>
												<td className="px-3 py-2">
													<span
														className={cn(
															'rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
															row.marketing_rag_included
																? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/35'
																: 'bg-(--desktop-text-dim)/15 text-(--desktop-text-muted) ring-(--desktop-border-subtle)'
														)}
													>
														{row.marketing_rag_included
															? t('projectRagView.inRagYes')
															: t('projectRagView.inRagNo')}
													</span>
												</td>
												<td className="px-3 py-2 text-right">
													<DesktopAppButton
														type="button"
														variant="neutral"
														size="sm"
														disabled={patchMutation.isPending}
														onClick={() =>
															patchMutation.mutate({
																contentId: row.content_id,
																body: {
																	marketing_rag_included:
																		!row.marketing_rag_included,
																},
															})
														}
													>
														{row.marketing_rag_included
															? t('projectRagView.actionExclude')
															: t('projectRagView.actionInclude')}
													</DesktopAppButton>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				)}
			</SectionPanel>
		</div>
	);
}
