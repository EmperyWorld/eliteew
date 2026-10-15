/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable chip id for the companion OCR instrument (catalog-only, no LLM quick preset).
 *
 * Invariants:
 * - Must match ``companionEwaToolsRegistry`` row ``imageOcr``.
 *
 * Related:
 * - src/features/ewa/companionTools/companionOcrInstrument.ts
 */

import { EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX } from '@/services/ewa/ewaCompanionProfileApi';

export const COMPANION_IMAGE_OCR_TOOL_CHIP_ID =
	`${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}ewa.imageOcr` as const;

export function isCompanionImageOcrToolChip(chipId: string): boolean {
	return chipId === COMPANION_IMAGE_OCR_TOOL_CHIP_ID;
}
