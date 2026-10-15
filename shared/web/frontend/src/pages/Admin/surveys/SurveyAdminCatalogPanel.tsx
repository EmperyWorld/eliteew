/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Survey Hub catalog tab: KPI hero, toolbar, list cards, and create/duplicate actions.
 *
 * Invariants:
 * - List rendering is presentational; parent owns selection and navigation tab state.
 *
 * Related:
 * - pages/Admin/SurveysAdminSection.tsx
 * - documentation/product/SURVEY-HUB.md
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import type { SurveyAdmin } from '../../Desktop/services/productDesktopSurveysApi';
import { formatSurveyDateLabel } from '@/features/surveys/desktop/surveyHubUserUtils';
import { SurveyAdminCatalogKpiHero } from './SurveyAdminCatalogKpiHero';
import { SurveyAdminCatalogToolbar } from './SurveyAdminCatalogToolbar';
import {
	surveyAdminCatalogMeta,
	type SurveyAdminCatalogSummary,
} from './surveyAdminCatalogUtils';

type Props = {
	summary: SurveyAdminCatalogSummary;
	query: string;
	statusFilter: string;
	onQueryChange: (value: string) => void;
	onStatusChange: (value: string) => void;
	isLoading: boolean;
	isError: boolean;
	isRefreshing: boolean;
	onRefresh: () => void;
	allItems: SurveyAdmin[];
	visibleItems: SurveyAdmin[];
	selectedId: string | null;
	createPending: boolean;
	duplicatePending: boolean;
	onCreate: () => void;
	onOpenAiCreate: () => void;
	onOpenSurvey: (surveyId: string) => void;
	onDuplicate: (surveyId: string) => void;
};

export function SurveyAdminCatalogPanel({
	summary,
	query,
	statusFilter,
	onQueryChange,
	onStatusChange,
	isLoading,
	isError,
	isRefreshing,
	onRefresh,
	allItems,
	visibleItems,
	selectedId,
	createPending,
	duplicatePending,
	onCreate,
	onOpenAiCreate,
	onOpenSurvey,
	onDuplicate,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');

	return (
		<DesktopAppPanel className="space-y-4 p-4">
			<SurveyAdminCatalogKpiHero summary={summary} />
			<div className="flex flex-wrap items-center gap-2">
				<DesktopAppButton
					type="button"
					size="sm"
					variant="accent"
					disabled={createPending}
					onClick={onCreate}
				>
					{t('admin.createSurvey')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					onClick={onOpenAiCreate}
				>
					{t('admin.aiCreate.tabButton')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					disabled={isRefreshing}
					onClick={onRefresh}
				>
					{t('admin.refresh')}
				</DesktopAppButton>
			</div>
			<SurveyAdminCatalogToolbar
				query={query}
				statusFilter={statusFilter}
				onQueryChange={onQueryChange}
				onStatusChange={onStatusChange}
			/>
			{isLoading ? (
				<p className={DESKTOP_TYPOGRAPHY.meta}>{t('admin.loading')}</p>
			) : isError ? (
				<p className={DESKTOP_TYPOGRAPHY.meta}>{t('admin.loadError')}</p>
			) : visibleItems.length === 0 ? (
				<DesktopAppEmptyState
					className="min-h-40 rounded-(--desktop-radius-lg) border border-dashed border-(--desktop-border-subtle)"
					title={
						allItems.length === 0
							? t('admin.catalogEmpty')
							: t('admin.catalogSearchEmpty')
					}
					description={
						allItems.length === 0
							? t('admin.catalogEmptyHint')
							: t('admin.catalogSearchEmptyHint')
					}
				>
					<div className="flex flex-wrap justify-center gap-2">
						<DesktopAppButton
							type="button"
							size="sm"
							variant="accent"
							onClick={onOpenAiCreate}
						>
							{t('admin.aiCreate.tabButton')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="neutral"
							disabled={createPending}
							onClick={onCreate}
						>
							{t('admin.createSurvey')}
						</DesktopAppButton>
					</div>
				</DesktopAppEmptyState>
			) : (
				<ul className="grid gap-3 md:grid-cols-2">
					{visibleItems.map((item) => {
						const meta = surveyAdminCatalogMeta(item);
						const closesLabel = formatSurveyDateLabel(item.closes_at);
						return (
							<li
								key={item.id}
								className={cn(
									'flex flex-col rounded-(--desktop-radius-lg) border transition-colors',
									selectedId === item.id
										? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)]'
										: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)'
								)}
							>
								<button
									type="button"
									className="flex flex-1 flex-col gap-2 px-4 py-3 text-left hover:border-[rgb(var(--desktop-accent-rgb)/0.28)]"
									onClick={() => onOpenSurvey(item.id)}
								>
									<div className="flex items-start justify-between gap-2">
										<span className="font-medium text-(--desktop-text-primary)">
											{item.title}
										</span>
										<span
											className={cn(
												'shrink-0 rounded-full border px-2 py-0.5 text-xs',
												item.status === 'published'
													? 'border-[rgb(var(--desktop-accent-rgb)/0.35)] text-[rgb(var(--desktop-accent-rgb))]'
													: item.status === 'draft'
														? 'border-(--desktop-border-subtle) text-(--desktop-text-secondary)'
														: 'border-(--desktop-border-subtle) text-(--desktop-text-muted)'
											)}
										>
											{t(`admin.status.${item.status}`, {
												defaultValue: item.status,
											})}
										</span>
									</div>
									<p className={cn('line-clamp-2', DESKTOP_TYPOGRAPHY.meta)}>
										{item.description_user || t('admin.catalogNoDescription')}
									</p>
									<p className={DESKTOP_TYPOGRAPHY.caption}>
										{t('admin.catalogMeta', {
											questions: meta.questionCount,
											audience: meta.audienceSize,
											completed: item.completed_count ?? 0,
										})}
										{closesLabel
											? ` · ${t('admin.catalogClosesAt', { date: closesLabel })}`
											: ''}
									</p>
								</button>
								<div className="flex flex-wrap gap-2 border-t border-(--desktop-border-subtle) px-4 py-2">
									<DesktopAppButton
										type="button"
										size="sm"
										variant="neutral"
										onClick={() => onOpenSurvey(item.id)}
									>
										{t('admin.catalogOpen')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										size="sm"
										variant="ghost"
										disabled={duplicatePending}
										onClick={() => onDuplicate(item.id)}
									>
										{t('admin.duplicateDraft')}
									</DesktopAppButton>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</DesktopAppPanel>
	);
}
