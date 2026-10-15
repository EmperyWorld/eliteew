/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Idle prefetch helpers for heavy Marketing Cabinet route chunks and AMKA profile query.
 *
 * Invariants:
 * - Idempotent: repeated calls share the same dynamic import promise.
 * - Invoked from sidebar hover/focus only (not on initial cabinet mount).
 *
 * Related:
 * - shell/MarketingCabinetSidebar.tsx
 * - marketingCabinetQueryOptions.ts
 */

import type { QueryClient } from '@tanstack/react-query';

import { marketingCabinetSelfProfileQueryOptions } from './marketingCabinetQueryOptions';

let amkaChunkPrefetch: Promise<unknown> | null = null;

/** Preload AMKA lazy chunk before operator opens the section. */
export function prefetchMarketingCabinetAmkaChunk(): Promise<unknown> {
	amkaChunkPrefetch ??= import('@/features/amka/MarketingCabinetAmkaView');
	return amkaChunkPrefetch;
}

/** Warm `self-profile` cache used by AMKA operator config gate. */
export function prefetchMarketingCabinetSelfProfile(
	queryClient: QueryClient,
	userId: string
): void {
	void queryClient.prefetchQuery(
		marketingCabinetSelfProfileQueryOptions(userId)
	);
}
