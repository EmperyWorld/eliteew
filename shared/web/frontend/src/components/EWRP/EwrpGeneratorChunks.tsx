/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin barrel re-exporting EWRP shared UI chunks from `ewrpChunks/*` plus status/HTTP/date helpers.
 *
 * Invariants:
 * - Public import path stays `./EwrpGeneratorChunks` / `../EwrpGeneratorChunks` — consumers need zero path changes.
 * - Status labels and date formatting stay locale-aware via i18n; row action buttons expose per-action busy state for a11y.
 *
 * Related:
 * - `ewrpChunks/*`, `EWRPGeneratorMain.tsx`, `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`.
 */

export * from './ewrpChunks/ewrpGeneratorConstants';
export * from './ewrpChunks/ewrpHistoryExportHelpers';
export * from './ewrpChunks/EwrpFormChrome';
export * from './ewrpChunks/EwrpSlideOutlineRow';
export * from './ewrpChunks/EwrpDraftSlideRow';
export * from './ewrpChunks/EwrpHistoryRow';
export * from './ewrpChunks/EwrpDraftRestoreBanner';

export {
	EWRP_HISTORY_STALE_AFTER_MS,
	ewrpHistoryStatusIndicator,
	ewrpStatusChipClass,
	ewrpStatusLabel,
	isEwrpHistoryRowStale,
} from './ewrpStatusPhaseIndicator';

export { formatEwrpLocalDraftSavedAt } from './ewrpDraftDateFormat';
export { extractEwrpApiErrorDetail as extractApiErrorDetail } from './ewrpHttpErrors';
export { parseEwrpStatusResponse } from './ewrpStatusResponse';
