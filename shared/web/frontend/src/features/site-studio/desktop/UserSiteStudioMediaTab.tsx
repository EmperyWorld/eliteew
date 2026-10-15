/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Site Studio Desktop `media` tab panel.
 *
 * Invariants:
 * - Presentation-only; mutations go through controller handlers on `vm`.
 *
 * Related:
 * - features/site-studio/desktop/UserSiteStudioAppView.tsx
 */
import { Textarea } from '@components/atoms/Textarea';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { SiteStudioDraftCard } from './components/SiteStudioDraftCard';
import { SiteStudioImagePreview } from './components/SiteStudioImagePreview';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import { WORKSPACE_SCROLL_AREA_CLASS } from './userSiteStudioAppModel';
import type { UserSiteStudioTabVm } from './useUserSiteStudioAppController';

export function UserSiteStudioMediaTab({ vm }: { vm: UserSiteStudioTabVm }) {
	const { t } = useTranslation('siteStudio');
	const {
		instance,
		catalog,
		busyKeys,
		draftApplyReports,
		imagePrompts,
		setImagePrompts,
		imageProgress,
		siteStudioInsetTextareaClassName,
		mediaSummary,
		formatApplyReport,
		getDraftReviewState,
		handleGenerateImage,
		handleApplyImageDraft,
		renderPanelError,
		renderWorkspaceGuidedCockpit,
		safeDrafts,
	} = vm;

	if (!instance) {
		return null;
	}

	return (
		<div
			id="site-studio-panel-media"
			tabIndex={-1}
			className={WORKSPACE_SCROLL_AREA_CLASS}
		>
			{renderWorkspaceGuidedCockpit()}
			<div className="grid content-start gap-4">
				<DesktopAppPanel className="space-y-4 p-4">
					<div className="space-y-2">
						<DesktopAppSectionLabel>
							{t('media.panelTitle')}
						</DesktopAppSectionLabel>
						<p className="text-sm leading-6 text-(--desktop-text-secondary)">
							{t('media.panelDescription')}
						</p>
					</div>

					<DesktopAppSurface variant="soft" padding="sm" className="space-y-3">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
									{t('media.summaryTitle')}
								</div>
								<p className="mt-1 text-sm leading-6 text-(--desktop-text-secondary)">
									{t('media.summaryDescription')}
								</p>
							</div>
							<div className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1 text-xs text-(--desktop-text-secondary)">
								{t('media.summaryApplied', {
									applied: mediaSummary.applied,
									total: mediaSummary.drafts,
								})}
							</div>
						</div>
						<div className="grid gap-2 sm:grid-cols-3">
							{[
								{
									key: 'slots',
									label: t('media.summarySlots'),
									value: mediaSummary.slots,
								},
								{
									key: 'drafts',
									label: t('media.summaryDrafts'),
									value: mediaSummary.drafts,
								},
								{
									key: 'applied',
									label: t('media.summaryAppliedShort'),
									value: mediaSummary.applied,
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
							{mediaSummary.drafts > 0
								? t('media.summaryReadyHint')
								: t('media.summaryEmptyHint')}
						</p>
					</DesktopAppSurface>

					<div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
						{(catalog?.imageSlots ?? []).map((slot) => {
							const existingDraft = safeDrafts.imageDrafts.find(
								(draft) => draft.slotId === slot.slotId
							);

							return (
								<DesktopAppSurface
									key={slot.slotId}
									variant="soft"
									padding="sm"
									className="space-y-3"
								>
									<div className="space-y-1">
										<div className="flex flex-wrap items-start justify-between gap-2">
											<div className="text-sm font-semibold text-(--desktop-text-primary)">
												{slot.title}
											</div>
											<span className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-(--desktop-text-dim)">
												{existingDraft
													? t('media.slotReady')
													: t('media.slotEmpty')}
											</span>
										</div>
										<p className="text-sm leading-6 text-(--desktop-text-secondary)">
											{slot.description}
										</p>
										<div className="text-xs text-(--desktop-text-dim)">
											{slot.recommendedWidth}x{slot.recommendedHeight}
										</div>
									</div>
									<DesktopAppSurface
										variant="soft"
										padding="sm"
										className={
											existingDraft
												? 'border border-emerald-400/25 bg-emerald-500/8'
												: 'border border-amber-400/25 bg-amber-500/8'
										}
									>
										<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
											{t('media.slotStatusTitle')}
										</div>
										<p className="mt-1 text-xs leading-5 text-(--desktop-text-secondary)">
											{existingDraft
												? t('media.slotStatusReady', {
														title: existingDraft.title,
													})
												: t('media.slotStatusEmpty')}
										</p>
									</DesktopAppSurface>
									<Textarea
										value={imagePrompts[slot.slotId] ?? ''}
										onChange={(event) =>
											setImagePrompts((previous) => ({
												...previous,
												[slot.slotId]: event.target.value,
											}))
										}
										rows={4}
										className={siteStudioInsetTextareaClassName}
										placeholder={t('media.promptPlaceholder')}
									/>
									<div className="flex flex-wrap gap-2">
										<DesktopAppButton
											type="button"
											variant="accent"
											disabled={busyKeys.has(`image:${slot.slotId}`)}
											onClick={() =>
												handleGenerateImage(slot).catch(() => undefined)
											}
										>
											{busyKeys.has(`image:${slot.slotId}`) ? (
												<ArrowPathIcon className="h-4 w-4 animate-spin" />
											) : (
												<SparklesIcon className="h-4 w-4" />
											)}
											{t('media.generateButton')}
										</DesktopAppButton>
									</div>
									{imageProgress[slot.slotId] ? (
										<div className="text-sm text-(--desktop-text-secondary)">
											{imageProgress[slot.slotId]}
										</div>
									) : null}
								</DesktopAppSurface>
							);
						})}
					</div>

					{renderPanelError('media')}
				</DesktopAppPanel>

				{safeDrafts.imageDrafts.length ? (
					<div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
						{safeDrafts.imageDrafts.map((draft) => (
							<SiteStudioDraftCard
								key={draft.id}
								eyebrow={t('media.imageEyebrow')}
								title={draft.title}
								summary={`${draft.description} · ${t(
									'draftReview.imageTarget',
									{
										page: draft.page,
										section: draft.section,
										key: draft.key,
									}
								)}`}
								createdAt={draft.createdAt}
								loading={busyKeys.has(`apply-image:${draft.id}`)}
								applyResult={formatApplyReport(draftApplyReports[draft.id])}
								actions={
									<DesktopAppButton
										type="button"
										variant="accent"
										disabled={busyKeys.has(`apply-image:${draft.id}`)}
										onClick={() =>
											handleApplyImageDraft(draft).catch(() => undefined)
										}
									>
										{busyKeys.has(`apply-image:${draft.id}`) ? (
											<ArrowPathIcon className="h-4 w-4 animate-spin" />
										) : (
											<ArrowDownTrayIcon className="h-4 w-4" />
										)}
										{t('media.applyImage')}
									</DesktopAppButton>
								}
							>
								<SiteStudioImagePreview
									imageUrl={draft.imageUrl}
									alt={draft.alt}
								/>
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
										{t('draftReview.imageTarget', {
											page: draft.page,
											section: draft.section,
											key: draft.key,
										})}
									</div>
								</DesktopAppSurface>
								<DesktopAppSurface
									variant="soft"
									padding="sm"
									className="space-y-1"
								>
									<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
										{t('media.detailsTitle')}
									</div>
									<div className="grid gap-1 text-sm leading-6 text-(--desktop-text-primary)">
										<div>
											{t('media.detailsSize', {
												width: draft.width,
												height: draft.height,
											})}
										</div>
										<div>
											{t('media.detailsPlacement', {
												placement: t('draftReview.imageTarget', {
													page: draft.page,
													section: draft.section,
													key: draft.key,
												}),
											})}
										</div>
										<div>{t('media.detailsAlt', { alt: draft.alt })}</div>
									</div>
								</DesktopAppSurface>
								<DesktopAppSurface
									variant="soft"
									padding="sm"
									className="space-y-1"
								>
									<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
										{t('media.promptTitle')}
									</div>
									<div className="text-sm leading-6 text-(--desktop-text-primary)">
										{draft.prompt}
									</div>
								</DesktopAppSurface>
							</SiteStudioDraftCard>
						))}
					</div>
				) : (
					<DesktopAppEmptyState
						icon={
							<SparklesIcon className="h-7 w-7 text-[rgb(var(--desktop-accent-rgb))]" />
						}
						title={t('media.emptyTitle')}
						description={t('media.emptyDescription')}
					/>
				)}
			</div>
		</div>
	);
}
