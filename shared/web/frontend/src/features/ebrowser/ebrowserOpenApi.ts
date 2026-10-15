/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EBrowser policy DTOs from the OpenAPI pilot (no hand twin schemas).
 *
 * Invariants:
 * - Sourced only from `src/generated/ebrowser-openapi.ts`.
 *
 * Related:
 * - openapi/pilot/ebrowser.openapi.json
 * - features/ebrowser/ebrowserPolicyApi.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md
 */

import type { components } from '@/generated/ebrowser-openapi';

type Schemas = components['schemas'];

export type EBrowserPolicyResponse = Schemas['EBrowserPolicyResponse'];
export type EBrowserPolicyPut = Schemas['EBrowserPolicyPut'];

/** Alias used by chrome / native snapshot mapping. */
export type EBrowserPolicyApi = EBrowserPolicyResponse;
