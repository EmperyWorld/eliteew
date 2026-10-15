/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Type aliases for companion operations UI (Phase 2–3); API shapes stay in ewaCompanionChatApi.
 *
 * Invariants:
 * - Re-export only; do not duplicate runtime contracts.
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 * - documentation/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md §8.3
 */

export type {
	CompanionChatAction,
	CompanionTaskStepPayload,
	EwaCompanionTaskRun,
	EwaCompanionTaskStep,
} from '@/services/ewa/ewaCompanionChatApi';

export type { CompanionTranscriptProgressItem } from '@/features/ewa/companionOperations/companionOperationsUi';

export type { OperationReadyImage } from '@/features/ewa/companionOperations/companionOperationsUi';
