/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin OpenAPI bridge for the KBSEW gateway pilot — path locks + schema aliases.
 * Admin HTTP clients import types from here (not `src/generated/` directly).
 *
 * Invariants:
 * - Sourced only from `src/generated/kbsew-openapi.ts`.
 * - Hot-path DTOs are bridge aliases of Out/In schemas (no parallel hand twins).
 *
 * Related:
 * - src/pages/Admin/kbsewAdminApi.ts
 * - shared/api/schemas/kbsew_gateway.py
 * - shared/api/routers/kbsew_gateway.py
 * - documentation/api/FRONTEND-BACKEND-HTTP.md
 */

import type { components, paths } from '@/generated/kbsew-openapi';

type Schemas = components['schemas'];

export type KbsewBarrelsGetOperation = paths['/api/v1/kbsew/barrels']['get'];
export type KbsewBarrelsPostOperation = paths['/api/v1/kbsew/barrels']['post'];
export type KbsewReadyGetOperation = paths['/api/v1/kbsew/ready']['get'];

export type KbsewBarrelOut = Schemas['KbsewBarrelOut'];
export type KbsewBarrelCreateIn = Schemas['KbsewBarrelCreateIn'];
export type KbsewBarrelStatusOut = Schemas['KbsewBarrelStatusOut'];
export type KbsewIngestJobOut = Schemas['KbsewIngestJobOut'];
export type KbsewIngestIn = Schemas['KbsewIngestIn'];
export type KbsewIngestOut = Schemas['KbsewIngestOut'];
export type KbsewReadyOut = Schemas['KbsewReadyOut'];
export type KbsewDriversOut = Schemas['KbsewDriversOut'];
export type KbsewForceReindexAssetOut = Schemas['KbsewForceReindexAssetOut'];
export type KbsewForceReindexBarrelOut = Schemas['KbsewForceReindexBarrelOut'];
export type AdminKbsewSearchBody = Schemas['AdminKbsewSearchBody'];
export type AdminKbsewSearchOut = Schemas['AdminKbsewSearchOut'];

/** Compat aliases for existing admin UI / helpers (transition names). */
export type KbsewBarrel = KbsewBarrelOut;
export type KbsewBarrelStatus = KbsewBarrelStatusOut;
export type KbsewIngestJob = KbsewIngestJobOut;
export type KbsewReadyResponse = KbsewReadyOut;
export type KbsewIngestResponse = KbsewIngestOut;
export type KbsewForceReindexAssetResult = KbsewForceReindexAssetOut;
export type KbsewForceReindexBarrelResult = KbsewForceReindexBarrelOut;
export type KbsewSearchResponse = AdminKbsewSearchOut;
export type KbsewRetrievalMode = NonNullable<
	AdminKbsewSearchBody['retrieval_mode']
>;
