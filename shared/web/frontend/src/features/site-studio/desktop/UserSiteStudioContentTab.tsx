import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppSurface,
	DESKTOP_APP_STYLE_CONTRACT,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { SiteStudioDraftCard } from './components/SiteStudioDraftCard';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	CpuChipIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import { WORKSPACE_SCROLL_AREA_CLASS } from './userSiteStudioAppModel';
import type { UserSiteStudioTabVm } from './useUserSiteStudioAppController';

export function UserSiteStudioContentTab({ vm }: { vm: UserSiteStudioTabVm }) {
	const { t } = useTranslation('siteStudio');
	const {
		instance,
		setActiveTab,
		busyKeys,
		panelErrors,
		draftApplyReports,
		draftReviewSummary,
		formatApplyReport,
		getDraftReviewState,
		handleApplyContentDraft,
		handleApplySeoDraft,
		renderPanelError,
		renderWorkspaceGuidedCockpit,
		safeDrafts,
	} = vm;

	if (!instance) {
		return null;
	}

	return (
		<div
			id="site-studio-panel-content"
			tabIndex={-1}
			className={WORKSPACE_SCROLL_AREA_CLASS}
		>
			{renderWorkspaceGuidedCockpit()}
			<div className="grid content-start gap-4">
				<DesktopAppPanel className="space-y-4 p-4">
					<div className="space-y-2">
						<h2
							id="site-studio-apply-title"
							className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}
						>
							{t('draftReview.panelTitle')}
						</h2>
						<p className="text-sm leading-6 text-(--desktop-text-secondary)">
							{t('draftReview.panelDescription')}
						</p>
					</div>
				</DesktopAppPanel>

				<DesktopAppSurface variant="soft" padding="sm" className="space-y-3">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
								{t('draftReview.summaryTitle')}
							</div>
							<p className="mt-1 text-sm leading-6 text-(--desktop-text-secondary)">
								{t('draftReview.summaryDescription')}
							</p>
						</div>
						<div className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1 text-xs text-(--desktop-text-secondary)">
							{t('draftReview.summaryApplied', {
								applied: draftReviewSummary.applied,
								total: draftReviewSummary.total,
							})}
						</div>
					</div>
					<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
						{[
							{
								key: 'content',
								label: t('draftReview.summaryContent'),
								value: draftReviewSummary.content,
							},
							{
								key: 'seo',
								label: t('draftReview.summarySeo'),
								value: draftReviewSummary.seo,
							},
							{
								key: 'images',
								label: t('draftReview.summaryImages'),
								value: draftReviewSummary.images,
							},
							{
								key: 'applied',
								label: t('draftReview.summaryAppliedShort'),
								value: draftReviewSummary.applied,
							},
						].map((item) => (
							<div
								key={item.key}
								className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/70 p-3"
							>
								<div className="text-2xl font-semibold text-(--desktop-text-primary)">
									{item.value}
								</div>
								<div className="mt-1 text-xs text-(--desktop-text-secondary)">
									{item.label}
								</div>
							</div>
						))}
					</div>
					<p className="text-xs leading-5 text-(--desktop-text-secondary)">
						{draftReviewSummary.applied === draftReviewSummary.total &&
						draftReviewSummary.total > 0
							? t('draftReview.summaryAllAppliedHint')
							: t('draftReview.summaryNeedsReviewHint')}
					</p>
				</DesktopAppSurface>

				{safeDrafts.contentDrafts.length || safeDrafts.seoDrafts.length ? (
					<div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
						{safeDrafts.contentDrafts.map((draft, draftIndex) => (
							<SiteStudioDraftCard
								key={draft.id}
								eyebrow={t('draftReview.contentEyebrow')}
								title={draft.title}
								summary={`${draft.summary} · ${t('draftReview.contentBlocks', {
									count: draft.blocks.length,
								})}`}
								createdAt={draft.createdAt}
								loading={busyKeys.has(`apply-content:${draft.id}`)}
								error={draftIndex === 0 ? panelErrors.content : undefined}
								applyResult={formatApplyReport(draftApplyReports[draft.id])}
								actions={
									<DesktopAppButton
										type="button"
										variant="accent"
										disabled={busyKeys.has(`apply-content:${draft.id}`)}
										onClick={() =>
											handleApplyContentDraft(draft).catch(() => undefined)
										}
									>
										{busyKeys.has(`apply-content:${draft.id}`) ? (
											<ArrowPathIcon className="h-4 w-4 animate-spin" />
										) : (
											<SparklesIcon className="h-4 w-4" />
										)}
										{t('draftReview.applyContent')}
									</DesktopAppButton>
								}
							>
								<DesktopAppSurface
									variant="soft"
									padding="sm"
									className="border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)"
								>
									<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
										{t('draftReview.reviewState')}
									</div>
									<div className="mt-1 text-sm font-medium text-(--desktop-text-primary)">
										{getDraftReviewState(draftApplyReports[draft.id])}
									</div>
									<div className="mt-1 text-xs text-(--desktop-text-secondary)">
										{t('draftReview.contentReviewHint', {
											count: draft.blocks.length,
										})}
									</div>
								</DesktopAppSurface>
								{draft.blocks.slice(0, 8).map((block) => (
									<DesktopAppSurface
										key={`${block.page}-${block.section}-${block.key}`}
										variant="soft"
										padding="sm"
										className="space-y-1"
									>
										<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
											{block.label}
										</div>
										<div className="text-sm leading-6 text-(--desktop-text-primary)">
											{block.value}
										</div>
									</DesktopAppSurface>
								))}
							</SiteStudioDraftCard>
						))}

						{safeDrafts.seoDrafts.map((draft, draftIndex) => (
							<SiteStudioDraftCard
								key={draft.id}
								eyebrow={t('draftReview.seoEyebrow')}
								title={draft.title}
								summary={`${draft.summary} · ${t('draftReview.seoReadiness', {
									title: draft.siteSettings.siteTitle
										? t('draftReview.ready')
										: t('draftReview.missing'),
									description: draft.siteSettings.siteDescription
										? t('draftReview.ready')
										: t('draftReview.missing'),
								})}`}
								createdAt={draft.createdAt}
								loading={busyKeys.has(`apply-seo:${draft.id}`)}
								applyResult={formatApplyReport(draftApplyReports[draft.id])}
								error={
									!safeDrafts.contentDrafts.length && draftIndex === 0
										? panelErrors.content
										: undefined
								}
								actions={
									<DesktopAppButton
										type="button"
										variant="accent"
										disabled={busyKeys.has(`apply-seo:${draft.id}`)}
										onClick={() =>
											handleApplySeoDraft(draft).catch(() => undefined)
										}
									>
										{busyKeys.has(`apply-seo:${draft.id}`) ? (
											<ArrowPathIcon className="h-4 w-4 animate-spin" />
										) : (
											<ArrowDownTrayIcon className="h-4 w-4" />
										)}
										{t('draftReview.applySeo')}
									</DesktopAppButton>
								}
							>
								<DesktopAppSurface
									variant="soft"
									padding="sm"
									className="border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)"
								>
									<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
										{t('draftReview.reviewState')}
									</div>
									<div className="mt-1 text-sm font-medium text-(--desktop-text-primary)">
										{getDraftReviewState(draftApplyReports[draft.id])}
									</div>
									<div className="mt-1 text-xs text-(--desktop-text-secondary)">
										{t('draftReview.seoReadiness', {
											title: draft.siteSettings.siteTitle
												? t('draftReview.ready')
												: t('draftReview.missing'),
											description: draft.siteSettings.siteDescription
												? t('draftReview.ready')
												: t('draftReview.missing'),
										})}
									</div>
								</DesktopAppSurface>
								<DesktopAppSurface
									variant="soft"
									padding="sm"
									className="space-y-1"
								>
									<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
										{t('draftReview.seoDescriptionLabel')}
									</div>
									<div className="text-sm leading-6 text-(--desktop-text-primary)">
										{draft.siteSettings.siteDescription ||
											t('draftReview.emptyValue')}
									</div>
								</DesktopAppSurface>
								{draft.keywords.length ? (
									<DesktopAppSurface
										variant="soft"
										padding="sm"
										className="space-y-1"
									>
										<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
											{t('draftReview.keywordsLabel')}
										</div>
										<div className="text-sm leading-6 text-(--desktop-text-primary)">
											{draft.keywords.join(', ')}
										</div>
									</DesktopAppSurface>
								) : null}
								{draft.suggestions.length ? (
									<DesktopAppSurface
										variant="soft"
										padding="sm"
										className="space-y-1"
									>
										<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
											{t('draftReview.suggestionsLabel')}
										</div>
										<div className="space-y-1 text-sm leading-6 text-(--desktop-text-primary)">
											{draft.suggestions.map((item) => (
												<div key={item}>• {item}</div>
											))}
										</div>
									</DesktopAppSurface>
								) : null}
							</SiteStudioDraftCard>
						))}
					</div>
				) : (
					<>
						{panelErrors.content ? renderPanelError('content') : null}
						<DesktopAppEmptyState
							icon={
								<SparklesIcon className="h-7 w-7 text-[rgb(var(--desktop-accent-rgb))]" />
							}
							title={t('draftReview.emptyTitle')}
							description={t('draftReview.emptyDescription')}
						>
							<DesktopAppButton
								type="button"
								variant="accent"
								onClick={() => setActiveTab('ai')}
							>
								<CpuChipIcon className="h-4 w-4" />
								{t('draftReview.emptyAction')}
							</DesktopAppButton>
						</DesktopAppEmptyState>
					</>
				)}
			</div>
		</div>
	);
}
