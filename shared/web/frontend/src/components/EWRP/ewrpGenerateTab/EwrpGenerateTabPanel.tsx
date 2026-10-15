/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentational Generate-tab form panel compose (`ewrp-panel-generate`).
 * Window chrome lives in `EwrpGeneratorAppChrome`; orchestration stays in Main/hook.
 *
 * Invariants:
 * - No second state store — all values/handlers arrive as props from Main.
 * - Public import path remains `EwrpGenerateTabPanel.tsx` facade → this module.
 *
 * Related:
 * - `../EwrpGenerateTabPanel.tsx` (facade)
 * - `EWRPGeneratorMain.tsx`, `EwrpGeneratorChunks.tsx`
 * - `documentation/product/EWRP-EDITOR.md`
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { sw } from '../EwrpGeneratorChunks';
import type { EwrpGenerateTabPanelProps } from './ewrpGenerateTabTypes';
import { useEwrpGenerateTabDerived } from './useEwrpGenerateTabDerived';
import { EwrpGenerateTabHistoryToolbar } from './EwrpGenerateTabHistoryToolbar';
import { EwrpGenerateTabActiveJobBanner } from './EwrpGenerateTabActiveJobBanner';
import { EwrpGenerateTabStickyContext } from './EwrpGenerateTabStickyContext';
import { EwrpGenerateTabTopicSection } from './EwrpGenerateTabTopicSection';
import { EwrpGenerateTabThemeSection } from './EwrpGenerateTabThemeSection';
import { EwrpGenerateTabContentSection } from './EwrpGenerateTabContentSection';
import { EwrpGenerateTabModelContextSection } from './EwrpGenerateTabModelContextSection';
import { EwrpGenerateTabDataSourceSection } from './EwrpGenerateTabDataSourceSection';
import { EwrpGenerateTabSubmitSection } from './EwrpGenerateTabSubmitSection';

export type { EwrpGenerateTabPanelProps } from './ewrpGenerateTabTypes';

export function EwrpGenerateTabPanel({
	secondaryBtnClass,
	primaryBtnClass,
	shellField,
	shellSelectClass,
	shellPanel,
	shellFrame,
	historyJobsCount,
	onOpenHistory,
	jobId,
	status,
	activeJobBannerHeadline,
	onOpenPresentationsStatus,
	topic,
	onTopicChange,
	title,
	onTitleChange,
	statusLiveText,
	numSlides,
	onNumSlidesChange,
	sourceDocument,
	onSourceDocumentClear,
	onSubmit,
	submitting,
	formLocked,
	presentationTheme,
	onPresentationThemeChange,
	firstSlideStyle,
	onFirstSlideStyleChange,
	webSearchQuality,
	onWebSearchQualityChange,
	extraContext,
	onExtraContextChange,
	sourceDocumentLoading,
	onOpenDocPicker,
	insufficientEnergy,
	presentationEnergyCost,
	ugsAvailableCredits,
	perSlideCredits,
}: EwrpGenerateTabPanelProps) {
	const { t } = useTranslation('ewrp');
	const derived = useEwrpGenerateTabDerived({
		topic,
		title,
		jobId,
		status,
		numSlides,
		presentationTheme,
		sourceDocumentLoading,
		shellPanel,
		shellFrame,
		perSlideCredits,
	});

	return (
		<div
			id="ewrp-panel-generate"
			role="tabpanel"
			aria-labelledby="ewrp-tab-generate"
			className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 lg:px-8"
		>
			<div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
				<EwrpGenerateTabHistoryToolbar
					secondaryBtnClass={secondaryBtnClass}
					historyJobsCount={historyJobsCount}
					onOpenHistory={onOpenHistory}
				/>
				<EwrpGenerateTabActiveJobBanner
					jobId={jobId}
					status={status}
					activeJobBannerHeadline={activeJobBannerHeadline}
					secondaryBtnClass={secondaryBtnClass}
					onOpenPresentationsStatus={onOpenPresentationsStatus}
				/>
				<EwrpGenerateTabStickyContext
					topic={topic}
					title={title}
					jobId={jobId}
					statusLiveText={statusLiveText}
					numSlides={numSlides}
					sourceDocument={sourceDocument}
					stickyContextBarClass={derived.stickyContextBarClass}
					stickyHeadline={derived.stickyHeadline}
					statusMetaSlideCount={derived.statusMetaSlideCount}
					stickySlidesMismatch={derived.stickySlidesMismatch}
					stickyFormThemeLabel={derived.stickyFormThemeLabel}
					stickyFormThemeDisplayLabel={derived.stickyFormThemeDisplayLabel}
					stickyJobThemeLabel={derived.stickyJobThemeLabel}
					stickyThemeMismatch={derived.stickyThemeMismatch}
					stickyFormSourcePending={derived.stickyFormSourcePending}
				/>
				<form
					id="ewrp-generator-form"
					onSubmit={onSubmit}
					className="space-y-6"
					aria-busy={submitting || undefined}
					data-ewrp-guide="outline-form"
				>
					{submitting ? (
						<div
							role="status"
							className="flex items-center gap-2 rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.06)] px-3 py-2.5"
						>
							<ArrowPathIcon
								className="h-4 w-4 shrink-0 animate-spin text-[rgb(var(--desktop-accent-rgb)/0.95)]"
								strokeWidth={sw}
								aria-hidden
							/>
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'min-w-0 flex-1 text-(--desktop-text-secondary)'
								)}
							>
								{t('form.submittingHint')}
							</p>
						</div>
					) : null}
					{formLocked ? (
						<div
							role="note"
							className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.06)] px-3 py-2.5"
						>
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'min-w-0 flex-1 text-(--desktop-text-secondary)'
								)}
							>
								{t('form.formLockedHint')}
							</p>
							<button
								type="button"
								onClick={onOpenPresentationsStatus}
								className={cn(secondaryBtnClass, 'shrink-0 text-[11px]')}
							>
								{t('tabs.openStatus')}
							</button>
						</div>
					) : null}
					<EwrpGenerateTabTopicSection
						topic={topic}
						onTopicChange={onTopicChange}
						shellField={shellField}
						formLocked={formLocked}
						ewrpTopicHeroClass={derived.ewrpTopicHeroClass}
					/>
					<EwrpGenerateTabThemeSection
						presentationTheme={presentationTheme}
						onPresentationThemeChange={onPresentationThemeChange}
						shellSelectClass={shellSelectClass}
						formLocked={formLocked}
						ewrpFieldsetShellClass={derived.ewrpFieldsetShellClass}
					/>
					<EwrpGenerateTabContentSection
						title={title}
						onTitleChange={onTitleChange}
						numSlides={numSlides}
						onNumSlidesChange={onNumSlidesChange}
						firstSlideStyle={firstSlideStyle}
						onFirstSlideStyleChange={onFirstSlideStyleChange}
						shellField={shellField}
						shellSelectClass={shellSelectClass}
						formLocked={formLocked}
						ewrpFieldsetShellClass={derived.ewrpFieldsetShellClass}
						ewrpOptionalFieldBlockClass={derived.ewrpOptionalFieldBlockClass}
					/>
					<EwrpGenerateTabModelContextSection
						webSearchQuality={webSearchQuality}
						onWebSearchQualityChange={onWebSearchQualityChange}
						extraContext={extraContext}
						onExtraContextChange={onExtraContextChange}
						shellField={shellField}
						shellSelectClass={shellSelectClass}
						formLocked={formLocked}
						ewrpFieldsetOptionalShellClass={
							derived.ewrpFieldsetOptionalShellClass
						}
					/>
					<EwrpGenerateTabDataSourceSection
						sourceDocument={sourceDocument}
						sourceDocumentLoading={sourceDocumentLoading}
						onSourceDocumentClear={onSourceDocumentClear}
						onOpenDocPicker={onOpenDocPicker}
						secondaryBtnClass={secondaryBtnClass}
						primaryBtnClass={primaryBtnClass}
						formLocked={formLocked}
						ewrpFieldsetOptionalShellClass={
							derived.ewrpFieldsetOptionalShellClass
						}
					/>
					<EwrpGenerateTabSubmitSection
						submitting={submitting}
						formLocked={formLocked}
						insufficientEnergy={insufficientEnergy}
						presentationEnergyCost={presentationEnergyCost}
						ugsAvailableCredits={ugsAvailableCredits}
						numSlides={numSlides}
						perSlideCredits={perSlideCredits}
						primaryBtnClass={primaryBtnClass}
						presentationEnergyDetail={derived.presentationEnergyDetail}
					/>
				</form>
			</div>
		</div>
	);
}
