/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OpenAPI SSOT bridge for Desktop App Store admin DTOs (`desktop-openapi` pilot).
 *
 * Invariants:
 * - Sourced only from `@/generated/desktop-openapi` — no hand twins.
 *
 * Related:
 * - pages/Desktop/services/desktopAdminApi.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 3
 */

import type { components } from '@/generated/desktop-openapi';

type Schemas = components['schemas'];

export type CatalogAppResponse = Schemas['CatalogAppResponse'];
export type CatalogAppCreate = Schemas['CatalogAppCreate'];
export type CatalogAppUpdate = Schemas['CatalogAppUpdate'];

/** UI-compat alias for `DesktopAccessGroupRef` embedded in catalog rows. */
export type CatalogAccessGroupRef = Schemas['DesktopAccessGroupRef'];
export type DesktopAccessGroupRef = Schemas['DesktopAccessGroupRef'];

export type AccessGroupResponse = Schemas['AccessGroupResponse'];
export type AccessGroupCreate = Schemas['AccessGroupCreate'];
export type AccessGroupUpdate = Schemas['AccessGroupUpdate'];

export type UserAppAccessGroupResponse = Schemas['UserAppAccessGroupResponse'];
export type UserAppAccessGroupUpdate = Schemas['UserAppAccessGroupUpdate'];

export type UserEwBalanceSetBody = Schemas['UserEwBalanceSetBody'];
export type UserUgsCreditsSetBody = Schemas['UserUgsCreditsSetBody'];

/** UI-compat alias for quota GET/PATCH responses. */
export type WebSearchQuotaStatusResponse =
	Schemas['WebSearchQuotaStatusResponse'];
export type WebSearchQuotaStatus = Schemas['WebSearchQuotaStatusResponse'];

export type UserWebSearchQuotaPatch = Schemas['UserWebSearchQuotaPatch'];
