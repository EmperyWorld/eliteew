/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public frontend feature boundary for Marketing Cabinet AMKA (runs, builder, timeline, projection).
 *
 * Invariants:
 * - EWA platform desktop/companion UI lives under `src/features/ewa/` — not re-exported here.
 * - Existing Marketing Cabinet contracts remain source-compatible during extraction.
 * - New AMKA UI imports should prefer this feature boundary over deep `pages/MarketingCabinet` paths.
 *
 * Related:
 * - src/features/amka/MarketingCabinetAmkaView.tsx
 * - src/hooks/api/useAmka.ts
 * - src/services/amka/marketingCabinetAmkaBridge.ts
 */
export type { MarketingCabinetAmkaViewProps } from './MarketingCabinetAmkaView';
export { AmkaView } from './AmkaView';
export { AmkaBuilderView } from './AmkaBuilderView';
export { AmkaOnboardingIntro } from './AmkaOnboardingIntro';
export { AmkaRunQualityHints } from './AmkaRunQualityHints';
export { AmkaStepDetailBody } from './AmkaStepDetailBody';
export type { AmkaPipelineStageId } from './AmkaBuilderStageForm';
export { AmkaEntrypointNotice } from './AmkaEntrypointNotice';
export { AmkaFinalAssessmentSection } from './AmkaFinalAssessmentSection';
export type { AmkaFinalAssessmentSectionProps } from './AmkaFinalAssessmentSection';
export { AmkaStepRunningBanner } from './AmkaStepRunningBanner';
export type {
	AmkaStepRunningBannerProps,
	AmkaStepRunningBannerStep,
} from './AmkaStepRunningBanner';
export { AmkaProjectionSummary } from './AmkaProjectionSummary';
export { AmkaPulsePanel } from './AmkaPulsePanel';
export { AmkaPipelineTimeline } from './AmkaPipelineTimeline';
export type { AmkaTimelineStageId } from './amkaTimelineModel';
export {
	computeAmkaTimelineState,
	timelineConnectorClass,
} from './amkaTimelineModel';
export type { AmkaPulseArtifact, AmkaStandaloneProjection } from './amkaTypes';
export {
	getAmkaProjectionStageCounts,
	getAmkaProjectionStatusCounts,
	getAmkaProjectionTraceCount,
	hasAmkaStandaloneProjection,
} from './amkaProjectionModel';

export {
	AMKA_POLL_FLOOR_MS,
	computeAmkaRunDetailRefetchMs,
	computeAmkaRunsListRefetchMs,
	useAmkaOperatorConfig,
	useAmkaPresets,
	useAmkaRunDetail,
	useAmkaRuns,
	useApproveAmkaRun,
	useCancelAmkaRun,
	useContinueAmkaStep,
	useCreateAmkaRun,
	usePutAmkaOperatorConfig,
	useResumeAmkaRun,
} from '@/hooks/api/useAmka';
export { buildAmkaFinalAssessmentItems } from './amkaFinalAssessmentModel';
export type { AmkaFinalMetricItem } from './amkaFinalAssessmentModel';
