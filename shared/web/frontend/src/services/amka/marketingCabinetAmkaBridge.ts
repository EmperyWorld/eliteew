/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single choke-point imports from Marketing Cabinet for the AMKA feature layer and `useAmka` hooks, so code under
 * `src/features/amka/` does not scatter `@/pages/MarketingCabinet/*` paths (standalone readiness).
 *
 * Invariants:
 * - Re-exports only; behavior and types remain defined by Marketing Cabinet modules and OpenAPI.
 * - Call sites outside AMKA should keep using cabinet paths until a broader client split is planned.
 *
 * Related:
 * - src/pages/MarketingCabinet/marketingCabinetApi.ts
 * - src/hooks/api/useAmka.ts
 * - src/features/amka/
 * - documentation/product/amka-seed-album/AMKA-ENTRYPOINTS.md
 */
export type {
	AmkaAsyncStartResponse,
	AmkaControlResponse,
	AmkaCoreAlignmentResponse,
	AmkaOperation,
	AmkaOperatorConfigBundle,
	AmkaOperatorConfigV1,
	AmkaPresetConfigV1,
	AmkaPresetExtraPlanTaskIn,
	AmkaPresetListResponse,
	AmkaPresetTemplate,
	AmkaPresetTemplateListResponse,
	AmkaPulseArtifact,
	AmkaRun,
	AmkaRunDetailResponse,
	AmkaRunListResponse,
	AmkaRunStep,
	AmkaStandaloneProjection,
} from '@/pages/MarketingCabinet/marketingCabinetApi';
export { AMKA_OPERATOR_CONFIG_V1_DEFAULT } from '@/pages/MarketingCabinet/marketingCabinetApi';
export {
	buildMarketingCabinetDeepLinkForAmkaChildJob,
	buildMarketingCabinetDeepLinkForAmkaEntity,
} from '@/pages/MarketingCabinet/marketingCabinetAmkaDeepLink';
export type { MarketingCabinetDeepLinkState } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetNavigation';
export {
	extractApiErrorMessage,
	openDesktopApp,
} from '@/pages/MarketingCabinet/utils';
export { TEXTAREA_CLASS } from '@/pages/MarketingCabinet/constants';
export {
	AMKA_ENSEMBLE_TEMPLATE_HINT_OPTIONS,
	AMKA_PLAN_EXECUTION_MODE_OPTIONS,
	AMKA_PRESET_ACTIONABLE_SECTION_KEYS,
	AMKA_PRESET_INSERT_ANCHOR_KEYS,
} from '@/pages/MarketingCabinet/marketingCabinetAmkaPresetConstants';
export { ImcResearchResultMarkdown } from '@/pages/MarketingCabinet/components/ImcResearchResultMarkdown';
export { MarketingCabinetSelect } from '@/pages/MarketingCabinet/components/MarketingCabinetSelect';
export { SectionPanel } from '@/pages/MarketingCabinet/components/SectionPanel';
export { EmptyProjectState } from '@/pages/MarketingCabinet/components/EmptyProjectState';
export { AMKA_START_SECTION_KEYS } from '@/pages/MarketingCabinet/marketingCabinetAmkaDeepLink';
export { downloadAmkaRunMarkdown } from '@/pages/MarketingCabinet/marketingCabinetAmkaExport';
export { marketingCabinetApi } from '@/pages/MarketingCabinet/marketingCabinetApi';
