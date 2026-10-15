/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin OpenAPI aliases for the hand SSE-enriched EWA desktop-orchestration pilot.
 *
 * Invariants:
 * - Sourced only from `src/generated/ewa-desktop-orchestration-openapi.ts`.
 *
 * Related:
 * - src/services/ewa/ewaDesktopOrchApi.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md
 */

import type { components } from '@/generated/ewa-desktop-orchestration-openapi';

export type EwaDesktopOrchestrationCompanionHints =
	components['schemas']['EwaDesktopOrchestrationCompanionHints'];

export type EwaDesktopOrchestrationPayloadMetadata =
	components['schemas']['EwaDesktopOrchestrationPayloadMetadata'];

export type EwaDesktopOrchestrationTurnRequestEnvelope =
	components['schemas']['EwaDesktopOrchestrationTurnRequestEnvelope'];
