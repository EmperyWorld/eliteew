import { AnimatePresence, motion } from 'framer-motion';
import type { FC, FormEvent } from 'react';
import { useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateShort } from '../../../components/UnifiedContent/utils/contentUtils';
import type { ContentAdvancedSearchHit } from '../../../services/contentApi';
import { cn } from '../../../utils/cn';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppInput,
	DesktopAppSectionLabel,
	DesktopAppSkeleton,
	DesktopAppStatusBadge,
	DesktopNativeSelect,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { useDesktopShellFrame } from '../../Desktop/context/DesktopShellFrameContext';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowUturnLeftIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import {
	getDesktopShellContentPanelClassName,
	getDesktopShellFooterStripClassName,
} from '../../Desktop/utils/desktopVisualSystem';

export type AdvancedVisibilityFilter =
	| 'all'
	| 'private'
	| 'shared'
	| 'friends'
	| 'from_friends';

export interface ContentTypeOption {
	value: string;
	label: string;
}

export interface ContentManagerAdvancedSearchProps {
	showPanel: boolean;
	advancedQuery: string;
	setAdvancedQuery: (v: string) => void;
	advancedContentType: string;
	setAdvancedContentType: (v: string) => void;
	advancedVisibility: AdvancedVisibilityFilter;
	setAdvancedVisibility: (v: AdvancedVisibilityFilter) => void;
	advancedTags: string;
	setAdvancedTags: (v: string) => void;
	advancedDateFrom: string;
	setAdvancedDateFrom: (v: string) => void;
	advancedDateTo: string;
	setAdvancedDateTo: (v: string) => void;
	advancedSizeMin: string;
	setAdvancedSizeMin: (v: string) => void;
	advancedSizeMax: string;
	setAdvancedSizeMax: (v: string) => void;
	contentTypeOptions: ContentTypeOption[];
	clearAdvancedSearch: () => void;
	runAdvancedSearchPage: (page: number) => void | Promise<void>;
	advancedLoading: boolean;
	showResultsPanel: boolean;
	advancedError: string | null;
	advancedResults: ContentAdvancedSearchHit[];
	advancedTotal: number;
	advancedPage: number;
	advancedTotalPages: number;
	onHideResults: () => void;
	openContentById: (id: string) => void;
	downloadFile: (id: string, name: string) => void;
	resolveTypeLabel: (contentType: string) => string;
}

export const ContentManagerAdvancedSearch: FC<
	ContentManagerAdvancedSearchProps
> = ({
	showPanel,
	advancedQuery,
	setAdvancedQuery,
	advancedContentType,
	setAdvancedContentType,
	advancedVisibility,
	setAdvancedVisibility,
	advancedTags,
	setAdvancedTags,
	advancedDateFrom,
	setAdvancedDateFrom,
	advancedDateTo,
	setAdvancedDateTo,
	advancedSizeMin,
	setAdvancedSizeMin,
	advancedSizeMax,
	setAdvancedSizeMax,
	contentTypeOptions,
	clearAdvancedSearch,
	runAdvancedSearchPage,
	advancedLoading,
	showResultsPanel,
	advancedError,
	advancedResults,
	advancedTotal,
	advancedPage,
	advancedTotalPages,
	onHideResults,
	openContentById,
	downloadFile,
	resolveTypeLabel,
}) => {
	const { t, i18n } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellContentPanelClass = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const shellFooterStripClass = useMemo(
		() => getDesktopShellFooterStripClassName(shellFrame),
		[shellFrame]
	);
	const formErrorId = useId();
	const [formValidationError, setFormValidationError] = useState<string | null>(
		null
	);

	const clearFormValidation = useCallback(() => {
		setFormValidationError(null);
	}, []);

	const handleReset = useCallback(() => {
		setFormValidationError(null);
		clearAdvancedSearch();
	}, [clearAdvancedSearch]);

	const handleSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (advancedLoading) return;

			const q = advancedQuery.trim();
			if (!q) {
				setFormValidationError(t('advancedSearch.errorNeedQuery'));
				return;
			}

			if (
				advancedDateFrom &&
				advancedDateTo &&
				advancedDateFrom > advancedDateTo
			) {
				setFormValidationError(t('advancedSearch.validationDateRange'));
				return;
			}

			const minRaw = advancedSizeMin.trim();
			const maxRaw = advancedSizeMax.trim();
			const minN = minRaw === '' ? null : Number(advancedSizeMin);
			const maxN = maxRaw === '' ? null : Number(advancedSizeMax);
			const minOk = minN === null || Number.isFinite(minN);
			const maxOk = maxN === null || Number.isFinite(maxN);
			if (!minOk || !maxOk) {
				setFormValidationError(t('advancedSearch.validationSizeNumber'));
				return;
			}
			if (minN !== null && maxN !== null && minN > maxN) {
				setFormValidationError(t('advancedSearch.validationSizeRange'));
				return;
			}

			setFormValidationError(null);
			void runAdvancedSearchPage(1);
		},
		[
			advancedLoading,
			advancedQuery,
			advancedDateFrom,
			advancedDateTo,
			advancedSizeMin,
			advancedSizeMax,
			runAdvancedSearchPage,
			t,
		]
	);

	const queryInvalid = Boolean(formValidationError) && !advancedQuery.trim();

	const visibilityChipLabel = useCallback(
		(v: AdvancedVisibilityFilter) => {
			switch (v) {
				case 'private':
					return t('advancedSearch.visibilityPrivate');
				case 'friends':
					return t('advancedSearch.visibilityFriends');
				case 'from_friends':
					return t('advancedSearch.visibilityFromFriends');
				case 'shared':
					return t('advancedSearch.visibilityShared');
				default:
					return v;
			}
		},
		[t]
	);

	const activeFilterChips = useMemo(() => {
		const chips: { id: string; label: string }[] = [];
		const q = advancedQuery.trim();
		if (q) {
			chips.push({
				id: 'query',
				label: `${t('advancedSearch.fieldQuery')}: ${q.length > 80 ? `${q.slice(0, 77)}…` : q}`,
			});
		}
		if (advancedContentType && advancedContentType !== 'all') {
			chips.push({
				id: 'contentType',
				label: `${t('advancedSearch.fieldContentType')}: ${resolveTypeLabel(advancedContentType)}`,
			});
		}
		if (advancedVisibility !== 'all') {
			chips.push({
				id: 'visibility',
				label: `${t('advancedSearch.fieldVisibility')}: ${visibilityChipLabel(advancedVisibility)}`,
			});
		}
		const tagsTrim = advancedTags.trim();
		if (tagsTrim) {
			chips.push({
				id: 'tags',
				label: `${t('advancedSearch.fieldTags')}: ${tagsTrim.length > 48 ? `${tagsTrim.slice(0, 45)}…` : tagsTrim}`,
			});
		}
		if (advancedDateFrom) {
			chips.push({
				id: 'dateFrom',
				label: `${t('advancedSearch.dateFrom')}: ${advancedDateFrom}`,
			});
		}
		if (advancedDateTo) {
			chips.push({
				id: 'dateTo',
				label: `${t('advancedSearch.dateTo')}: ${advancedDateTo}`,
			});
		}
		if (advancedSizeMin.trim()) {
			chips.push({
				id: 'sizeMin',
				label: `${t('advancedSearch.sizeFrom')}: ${advancedSizeMin.trim()}`,
			});
		}
		if (advancedSizeMax.trim()) {
			chips.push({
				id: 'sizeMax',
				label: `${t('advancedSearch.sizeTo')}: ${advancedSizeMax.trim()}`,
			});
		}
		return chips;
	}, [
		advancedContentType,
		advancedDateFrom,
		advancedDateTo,
		advancedQuery,
		advancedSizeMax,
		advancedSizeMin,
		advancedTags,
		advancedVisibility,
		resolveTypeLabel,
		t,
		visibilityChipLabel,
	]);

	const hasActiveFilters = activeFilterChips.length > 0;

	return (
		<>
			<AnimatePresence>
				{showPanel && (
					<motion.div
						id="content-manager-advanced-search"
						role="region"
						aria-label={t('advancedSearch.regionLabel')}
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						className="mb-4 overflow-hidden"
					>
						<div
							className={cn(
								shellContentPanelClass,
								'min-h-0 overflow-hidden p-0'
							)}
						>
							<form noValidate onSubmit={handleSubmit}>
								<div className="space-y-6 p-4">
									<div>
										<div className="mb-3">
											<DesktopAppSectionLabel>
												{t('advancedSearch.sectionText')}
											</DesktopAppSectionLabel>
										</div>
										<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
											<div className="lg:col-span-2">
												<label
													htmlFor="cm-adv-query"
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'mb-1.5 block font-medium'
													)}
												>
													{t('advancedSearch.fieldQuery')}
												</label>
												<DesktopAppInput
													id="cm-adv-query"
													name="advancedQuery"
													value={advancedQuery}
													onChange={(e) => {
														clearFormValidation();
														setAdvancedQuery(e.target.value);
													}}
													placeholder={t('advancedSearch.queryPlaceholder')}
													autoComplete="off"
													aria-invalid={queryInvalid}
													aria-describedby={
														formValidationError ? formErrorId : undefined
													}
													className={cn(
														queryInvalid &&
															'border-red-400/50 ring-1 ring-red-400/35'
													)}
												/>
											</div>
											<div className="lg:col-span-2">
												<label
													htmlFor="cm-adv-tags"
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'mb-1.5 block font-medium'
													)}
												>
													{t('advancedSearch.fieldTags')}
												</label>
												<DesktopAppInput
													id="cm-adv-tags"
													name="advancedTags"
													value={advancedTags}
													onChange={(e) => {
														clearFormValidation();
														setAdvancedTags(e.target.value);
													}}
													placeholder={t('advancedSearch.tagsPlaceholder')}
													autoComplete="off"
												/>
											</div>
										</div>
									</div>

									<div>
										<div className="mb-3">
											<DesktopAppSectionLabel>
												{t('advancedSearch.sectionFilters')}
											</DesktopAppSectionLabel>
										</div>
										<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
											<div>
												<label
													htmlFor="cm-adv-content-type"
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'mb-1.5 block font-medium'
													)}
												>
													{t('advancedSearch.fieldContentType')}
												</label>
												<DesktopNativeSelect
													id="cm-adv-content-type"
													name="contentType"
													value={advancedContentType}
													onChange={(e) => {
														clearFormValidation();
														setAdvancedContentType(e.target.value);
													}}
													aria-label={t('advancedSearch.ariaContentType')}
												>
													<option
														value="all"
														className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
													>
														{t('advancedSearch.allTypes')}
													</option>
													{contentTypeOptions.map((opt) => (
														<option
															key={opt.value}
															value={opt.value}
															className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
														>
															{opt.label}
														</option>
													))}
												</DesktopNativeSelect>
											</div>
											<div>
												<label
													htmlFor="cm-adv-visibility"
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'mb-1.5 block font-medium'
													)}
												>
													{t('advancedSearch.fieldVisibility')}
												</label>
												<DesktopNativeSelect
													id="cm-adv-visibility"
													name="visibility"
													value={advancedVisibility}
													onChange={(e) => {
														clearFormValidation();
														setAdvancedVisibility(
															e.target.value as AdvancedVisibilityFilter
														);
													}}
													aria-label={t('advancedSearch.ariaVisibility')}
												>
													<option
														value="all"
														className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
													>
														{t('advancedSearch.visibilityAny')}
													</option>
													<option
														value="private"
														className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
													>
														{t('advancedSearch.visibilityPrivate')}
													</option>
													<option
														value="friends"
														className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
													>
														{t('advancedSearch.visibilityFriends')}
													</option>
													<option
														value="from_friends"
														className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
													>
														{t('advancedSearch.visibilityFromFriends')}
													</option>
													<option
														value="shared"
														className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
													>
														{t('advancedSearch.visibilityShared')}
													</option>
												</DesktopNativeSelect>
											</div>
											<div>
												<label
													htmlFor="cm-adv-date-from"
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'mb-1.5 block font-medium'
													)}
												>
													{t('advancedSearch.dateFrom')}
												</label>
												<DesktopAppInput
													id="cm-adv-date-from"
													name="dateFrom"
													type="date"
													value={advancedDateFrom}
													onChange={(e) => {
														clearFormValidation();
														setAdvancedDateFrom(e.target.value);
													}}
													className="w-full"
												/>
											</div>
											<div>
												<label
													htmlFor="cm-adv-date-to"
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'mb-1.5 block font-medium'
													)}
												>
													{t('advancedSearch.dateTo')}
												</label>
												<DesktopAppInput
													id="cm-adv-date-to"
													name="dateTo"
													type="date"
													value={advancedDateTo}
													onChange={(e) => {
														clearFormValidation();
														setAdvancedDateTo(e.target.value);
													}}
													className="w-full"
												/>
											</div>
											<div>
												<label
													htmlFor="cm-adv-size-from"
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'mb-1.5 block font-medium'
													)}
												>
													{t('advancedSearch.sizeFrom')}
												</label>
												<DesktopAppInput
													id="cm-adv-size-from"
													name="sizeMin"
													type="number"
													min="0"
													value={advancedSizeMin}
													onChange={(e) => {
														clearFormValidation();
														setAdvancedSizeMin(e.target.value);
													}}
													placeholder={t('advancedSearch.sizePlaceholderMin')}
													className="w-full"
												/>
											</div>
											<div>
												<label
													htmlFor="cm-adv-size-to"
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'mb-1.5 block font-medium'
													)}
												>
													{t('advancedSearch.sizeTo')}
												</label>
												<DesktopAppInput
													id="cm-adv-size-to"
													name="sizeMax"
													type="number"
													min="0"
													value={advancedSizeMax}
													onChange={(e) => {
														clearFormValidation();
														setAdvancedSizeMax(e.target.value);
													}}
													placeholder={t('advancedSearch.sizePlaceholderMax')}
													className="w-full"
												/>
											</div>
										</div>
									</div>

									{formValidationError ? (
										<div
											id={formErrorId}
											role="alert"
											className="rounded-(--desktop-radius) border border-red-400/40 bg-red-950/40 px-3 py-2.5 text-sm text-red-100/95"
										>
											{formValidationError}
										</div>
									) : null}

									{hasActiveFilters ? (
										<div className="space-y-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60 px-3 py-3">
											<div className="flex flex-wrap items-center justify-between gap-2">
												<span className="text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-muted)">
													{t('advancedSearch.sectionFilters')}
												</span>
												<DesktopAppButton
													type="button"
													variant="neutral"
													size="sm"
													onClick={handleReset}
													className="shrink-0 border border-(--desktop-border-subtle)"
													aria-label={t('advancedSearch.reset')}
												>
													<XMarkIcon className="h-3.5 w-3.5" aria-hidden />
													{t('advancedSearch.reset')}
												</DesktopAppButton>
											</div>
											{activeFilterChips.length > 0 ? (
												<ul className="m-0 flex list-none flex-wrap gap-2 p-0">
													{activeFilterChips.map((c) => (
														<li key={c.id}>
															<DesktopAppStatusBadge className="max-w-full whitespace-normal py-1.5 text-left text-[11px] leading-snug">
																<span className="wrap-break-word">
																	{c.label}
																</span>
															</DesktopAppStatusBadge>
														</li>
													))}
												</ul>
											) : null}
										</div>
									) : null}

									<p
										className={cn(
											DESKTOP_APP_STYLE_CONTRACT.helperText,
											'-mt-2'
										)}
									>
										{t('advancedSearch.hint')}
									</p>
								</div>

								<div
									className={cn(
										shellFooterStripClass,
										'flex min-w-0 shrink-0 flex-wrap items-center gap-2 px-4 py-3'
									)}
								>
									<p className="min-w-0 flex-1 basis-full text-[11px] leading-snug text-(--desktop-text-dim) sm:basis-auto">
										{t('advancedSearch.submitHint')}
									</p>
									<div className="ml-auto flex w-full min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
										<DesktopAppButton
											type="button"
											variant="neutral"
											size="sm"
											onClick={handleReset}
											className="border border-(--desktop-border-subtle)"
										>
											<ArrowUturnLeftIcon className="h-4 w-4" aria-hidden />
											{t('advancedSearch.reset')}
										</DesktopAppButton>
										<DesktopAppButton
											type="submit"
											variant="accent"
											size="sm"
											disabled={advancedLoading}
										>
											{advancedLoading ? (
												<ArrowPathIcon
													className="h-4 w-4 animate-spin"
													aria-hidden
												/>
											) : (
												<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
											)}
											{t('advancedSearch.find')}
										</DesktopAppButton>
									</div>
								</div>
							</form>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{showResultsPanel ? (
				<section
					className={cn(shellContentPanelClass, 'mb-4 min-h-0 p-4')}
					aria-labelledby="content-manager-advanced-results-heading"
					aria-busy={advancedLoading}
				>
					<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div className="min-w-0 flex-1">
							<h3
								id="content-manager-advanced-results-heading"
								className="text-sm font-semibold text-(--desktop-text-primary)"
							>
								{t('advancedSearch.resultsTitle')}
							</h3>
							<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1 tabular-nums')}>
								{advancedLoading ? (
									<span className="inline-flex items-center gap-1.5">
										<ArrowPathIcon
											className="h-3.5 w-3.5 animate-spin"
											aria-hidden
										/>
										{t('advancedSearch.updatingCount')}
									</span>
								) : (
									t('advancedSearch.foundCount', {
										count: advancedTotal,
									})
								)}
							</p>
						</div>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="shrink-0 self-start border border-(--desktop-border-subtle)"
							onClick={onHideResults}
						>
							<XMarkIcon className="h-4 w-4" aria-hidden />
							{t('advancedSearch.hide')}
						</DesktopAppButton>
					</div>
					{advancedError ? (
						<DesktopAppErrorState
							message={advancedError}
							onAction={() => void runAdvancedSearchPage(advancedPage)}
						/>
					) : advancedLoading ? (
						<div className="space-y-3" aria-busy="true" aria-live="polite">
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'flex items-center gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2.5'
								)}
							>
								<ArrowPathIcon
									className="h-4 w-4 shrink-0 animate-spin text-[rgb(var(--desktop-accent-rgb))]"
									aria-hidden
								/>
								<span>{t('advancedSearch.searching')}</span>
							</div>
							<DesktopAppSkeleton className="h-20" />
							<DesktopAppSkeleton className="h-20" />
							<DesktopAppSkeleton className="h-20" />
						</div>
					) : advancedResults.length === 0 ? (
						<DesktopAppEmptyState
							role="status"
							icon={
								<MagnifyingGlassIcon
									className="h-8 w-8 text-(--desktop-text-dim)"
									aria-hidden
								/>
							}
							title={t('advancedSearch.nothingFoundTitle')}
							description={t('advancedSearch.nothingFoundDesc')}
						/>
					) : (
						<>
							<fieldset
								className="m-0 min-w-0 space-y-2 border-0 p-0"
								aria-labelledby="content-manager-advanced-results-heading"
							>
								{advancedResults.map((result) => (
									<button
										key={result.id}
										type="button"
										className="flex w-full items-start justify-between gap-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-4 py-3 text-left outline-none transition-colors hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-panel-strong) focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/45"
										onClick={() => {
											void openContentById(result.id);
										}}
									>
										<div className="min-w-0 flex-1">
											<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
												{result.name}
											</div>
											<div className="mt-1 flex flex-wrap items-center gap-2">
												<DesktopAppStatusBadge>
													{resolveTypeLabel(result.content_type)}
												</DesktopAppStatusBadge>
												<span className="text-xs text-(--desktop-text-dim)">
													{formatDateShort(result.created_at, i18n.language)}
												</span>
											</div>
											{result.description ? (
												<p
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'mt-2 line-clamp-2'
													)}
												>
													{result.description}
												</p>
											) : null}
										</div>
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="icon"
											onClick={(event) => {
												event.stopPropagation();
												void downloadFile(result.id, result.name);
											}}
											aria-label={t('advancedSearch.downloadAria')}
										>
											<ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
										</DesktopAppButton>
									</button>
								))}
							</fieldset>
							{advancedTotalPages > 1 ? (
								<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-(--desktop-border-subtle) pt-4">
									<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'tabular-nums')}>
										{t('advancedSearch.pageInfo', {
											page: advancedPage,
											totalPages: advancedTotalPages,
										})}
									</p>
									<div className="flex gap-2">
										<DesktopAppButton
											type="button"
											variant="neutral"
											size="icon"
											className="h-9 w-9"
											disabled={advancedPage <= 1 || advancedLoading}
											onClick={() =>
												void runAdvancedSearchPage(advancedPage - 1)
											}
											aria-label={t('advancedSearch.prevPage')}
										>
											<ChevronLeftIcon className="h-4 w-4" aria-hidden />
										</DesktopAppButton>
										<DesktopAppButton
											type="button"
											variant="neutral"
											size="icon"
											className="h-9 w-9"
											disabled={
												advancedPage >= advancedTotalPages || advancedLoading
											}
											onClick={() =>
												void runAdvancedSearchPage(advancedPage + 1)
											}
											aria-label={t('advancedSearch.nextPage')}
										>
											<ChevronRightIcon className="h-4 w-4" aria-hidden />
										</DesktopAppButton>
									</div>
								</div>
							) : null}
						</>
					)}
				</section>
			) : null}
		</>
	);
};
