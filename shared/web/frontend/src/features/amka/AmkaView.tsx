/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin orchestrator for Marketing Cabinet AMKA run UI; delegates to amkaView/* modules.
 * Core alignment for the selected run uses AmkaCoreEngine via marketing cabinet API.
 *
 * Invariants:
 * - AMKA HTTP URLs and approve/resume/continue/cancel semantics stay aligned with AMKA-REFERENCE.
 * - Operator approval and destructive-operation controls remain visible before execution.
 * - A freshly started run stays selected in history until the runs list query includes it.
 *
 * Related:
 * - src/services/amka/marketingCabinetAmkaBridge.ts
 * - src/features/amka/MarketingCabinetAmkaView.tsx
 * - amkaView/useAmkaViewCompose.ts
 */
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { AmkaBuilderView } from '@/features/amka/AmkaBuilderView';
import { AmkaFinalAssessmentSection } from '@/features/amka/AmkaFinalAssessmentSection';
import { AmkaOnboardingIntro } from '@/features/amka/AmkaOnboardingIntro';
import { AmkaDestructiveApprovalBanner } from '@/features/amka/amkaView/AmkaDestructiveApprovalBanner';
import { AmkaMasterPlanPanel } from '@/features/amka/amkaView/AmkaMasterPlanPanel';
import { AmkaOverviewHealthPreview } from '@/features/amka/amkaView/AmkaOverviewHealthPreview';
import { AmkaRunErrorPanel } from '@/features/amka/amkaView/AmkaRunErrorPanel';
import { AmkaRunHistoryPanel } from '@/features/amka/amkaView/AmkaRunHistoryPanel';
import { AmkaRunProgressBar } from '@/features/amka/amkaView/AmkaRunProgressBar';
import { AmkaRunStatusHeader } from '@/features/amka/amkaView/AmkaRunStatusHeader';
import { AmkaRunToolbarActions } from '@/features/amka/amkaView/AmkaRunToolbarActions';
import { AmkaStartRunPanel } from '@/features/amka/amkaView/AmkaStartRunPanel';
import { AmkaStepsPagerPanel } from '@/features/amka/amkaView/AmkaStepsPagerPanel';
import { AmkaViewMainTabs } from '@/features/amka/amkaView/AmkaViewMainTabs';
import type { AmkaViewProps } from '@/features/amka/amkaView/amkaViewTypes';
import { useAmkaViewCompose } from '@/features/amka/amkaView/useAmkaViewCompose';
import {
	DesktopAppEmptyState,
	DesktopAppErrorState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	EmptyProjectState,
	extractApiErrorMessage,
	SectionPanel,
} from '@/services/amka/marketingCabinetAmkaBridge';

export function AmkaView({
	selectedProjectId,
	selectedCompanyId,
	canEditAmkaOperatorConfig = false,
	onOpenAiStudio,
}: AmkaViewProps) {
	const { t } = useTranslation('marketing');
	const c = useAmkaViewCompose({
		selectedProjectId,
		selectedCompanyId,
		canEditAmkaOperatorConfig,
		onOpenAiStudio,
	});

	return (
		<div className="space-y-3">
			<AmkaViewMainTabs
				mainTab={c.mainTab}
				runModeClusterClass={c.runModeClusterClass}
				runModeTabClass={c.runModeTabClass}
				onMainTabChange={c.handleMainTabChange}
			/>
			{c.mainTab === 'builder' ? (
				<AmkaBuilderView
					projectId={selectedProjectId}
					canEditGlobalConfig={canEditAmkaOperatorConfig}
					onGlobalDirtyChange={c.setBuilderGlobalDirty}
				/>
			) : !selectedProjectId || !selectedCompanyId ? (
				<EmptyProjectState
					title={t('amkaView.needProjectTitle')}
					description={t('amkaView.needProjectDescription')}
				/>
			) : (
				<div className="grid gap-4 xl:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
					<div className="space-y-4">
						<AmkaOnboardingIntro />
						<AmkaStartRunPanel
							busy={c.busy}
							startPending={c.createMutation.isPending}
							onStart={c.handleStart}
							runMode={c.runMode}
							onRunModeChange={c.setRunMode}
							runModeClusterClass={c.runModeClusterClass}
							runModeTabClass={c.runModeTabClass}
							autoCycleCount={c.autoCycleCount}
							onAutoCycleCountChange={c.setAutoCycleCount}
							autoCycleSelectOptions={c.autoCycleSelectOptions}
							perStepExecution={c.perStepExecution}
							onPerStepExecutionChange={c.setPerStepExecution}
							formCheckboxClass={c.formCheckboxClass}
							userInstruction={c.userInstruction}
							onUserInstructionChange={c.setUserInstruction}
							startPresetId={c.startPresetId}
							onStartPresetIdChange={c.setStartPresetId}
							presetStartOptions={c.presetStartOptions}
							presetsFetching={c.queries.presetsQuery.isFetching}
							onOpenBuilderTab={c.handleMainTabChange}
							imcTypeKey={c.imcTypeKey}
							onImcTypeKeyChange={c.setImcTypeKey}
							imcTypeSelectOptions={c.imcTypeSelectOptions}
							imcTypesLoading={c.queries.imcTypesQuery.isLoading}
							imcFocus={c.imcFocus}
							onImcFocusChange={c.setImcFocus}
							imcFocusSelectOptions={c.imcFocusSelectOptions}
							imcMaxWait={c.imcMaxWait}
							onImcMaxWaitChange={c.setImcMaxWait}
							sectionToggles={c.sectionToggles}
							onSectionToggle={(key) =>
								c.setSectionToggles((prev) => ({
									...prev,
									[key]: !prev[key],
								}))
							}
						/>
						<AmkaRunHistoryPanel
							runsQuery={c.queries.runsQuery}
							runs={c.runs}
							selectedRunId={c.selectedRunId}
							preferRunIdRef={c.preferRunIdRef}
							onSelectRun={c.setSelectedRunId}
						/>
					</div>

					<div className="space-y-4">
						<SectionPanel
							title={t('amkaView.runTitle')}
							description={t('amkaView.runDescription')}
							actions={
								c.selectedRun ? (
									<AmkaRunToolbarActions
										selectedRun={c.selectedRun}
										actionableState={c.actionableState}
										busy={c.busy}
										formCheckboxClass={c.formCheckboxClass}
										exportIncludeCoreAlignment={c.exportIncludeCoreAlignment}
										onExportIncludeCoreAlignmentChange={
											c.setExportIncludeCoreAlignment
										}
										failedStepIndex={c.failedStepIndex}
										stepPageSafeIndex={c.stepPageSafeIndex}
										onGoToFailedStep={() =>
											c.setStepPageIndex(c.failedStepIndex ?? 0)
										}
										onApprove={c.handleApprove}
										onContinueStep={c.handleContinueStep}
										onExportReport={c.handleExportReport}
										onResume={c.handleResume}
										onCancel={c.handleCancel}
									/>
								) : null
							}
						>
							{c.queries.detailQuery.isLoading && c.selectedRunId ? (
								<div className="flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
									<ArrowPathIcon
										className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									{t('amkaView.loadingRun')}
								</div>
							) : c.queries.detailQuery.isError ? (
								<DesktopAppErrorState
									message={
										<>
											<span className="block font-medium">
												{t('amkaView.runLoadError')}
											</span>
											<span className="mt-1 block text-(--desktop-text-muted)">
												{extractApiErrorMessage(
													c.queries.detailQuery.error,
													t('amkaView.runLoadError')
												)}
											</span>
										</>
									}
									actionLabel={t('amkaView.retry')}
									onAction={() => void c.queries.detailQuery.refetch()}
								/>
							) : !c.selectedRun ? (
								<DesktopAppEmptyState
									title={t('amkaView.noRunSelectedTitle')}
									description={t('amkaView.noRunSelectedDescription')}
								/>
							) : (
								<div className="space-y-4">
									<AmkaRunStatusHeader
										selectedRun={c.selectedRun}
										selectedRunId={c.selectedRunId}
										progressStreamLive={c.progressStreamLive}
										auditFallbackRatio={c.auditFallbackRatio}
										operationReview={c.operationReview}
										pulse={c.queries.detailQuery.data?.pulse}
										standaloneProjection={
											c.queries.detailQuery.data?.standalone_projection
										}
										hasTruncatedSectionAuditContext={
											c.hasTruncatedSectionAuditContext
										}
									/>

									{c.selectedRun.status === 'awaiting_approval' ? (
										<AmkaDestructiveApprovalBanner
											plannedDestructiveCount={c.plannedDestructiveCount}
										/>
									) : null}

									<AmkaOverviewHealthPreview
										overviewHealthPreview={
											c.queries.detailQuery.data?.overview_health_preview
										}
									/>

									<AmkaRunProgressBar
										progress={c.selectedRun.progress}
										runStatus={c.selectedRun.status}
										ensembleOutcomes={c.ensembleOutcomes}
									/>

									<AmkaRunErrorPanel
										runError={c.runError}
										runErrorMessage={c.runErrorMessage}
										failedEnsembleStep={c.failedEnsembleStep}
										canResume={c.actionableState.canResume}
									/>

									<AmkaMasterPlanPanel
										selectedRun={c.selectedRun}
										ensemblePlanTaskCount={c.ensemblePlanTaskCount}
										plannedOperations={c.plannedOperations}
										plannedDestructiveCount={c.plannedDestructiveCount}
										operationReview={c.operationReview}
										skipSectionKeys={c.skipSectionKeys}
										onSkipSectionKeysChange={c.setSkipSectionKeys}
										skipOperationKeys={c.skipOperationKeys}
										onSkipOperationKeysChange={c.setSkipOperationKeys}
										skipStepIds={c.skipStepIds}
										onSkipStepIdsChange={c.setSkipStepIds}
										busy={c.busy}
									/>

									<AmkaStepsPagerPanel
										steps={c.steps}
										stepPageSafeIndex={c.stepPageSafeIndex}
										runningStepIndex={c.runningStepIndex}
										runningStep={c.runningStep}
										currentStep={c.currentStep}
										stepJumpSelectOptions={c.stepJumpSelectOptions}
										busy={c.busy}
										selectedCompanyId={selectedCompanyId}
										selectedProjectId={selectedProjectId}
										onOpenAiStudio={onOpenAiStudio}
										onStepPageIndexChange={c.setStepPageIndex}
									/>

									<AmkaFinalAssessmentSection
										finalAssessment={
											c.selectedRun.final_assessment as
												| Record<string, unknown>
												| null
												| undefined
										}
										finalSummaryMarkdown={c.selectedRun.final_summary_markdown}
										t={t}
									/>
								</div>
							)}
						</SectionPanel>
					</div>
				</div>
			)}
		</div>
	);
}
