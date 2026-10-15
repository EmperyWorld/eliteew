/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-listing primary Unified Content thumbnail + photo count via `listRealtorPropertyMedia`, with eager fetch for the active workspace and viewport-based lazy fetch for grids.
 *
 * Invariants:
 * - `listingMediaRefreshAt` bump clears cached rows and retriggers eager fetches only; callers re-register viewport interest via `registerListingCoverInterest`.
 * - Single-property failures resolve to `{ primaryUnifiedContentId: null, photoTotal: 0 }`; stale responses are dropped when the cache generation changes.
 *
 * Related:
 * - api.ts (`listRealtorPropertyMedia`)
 * - PropertySavedListingCard.tsx
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { listRealtorPropertyMedia } from '../api';

export type ListingCoverResolved = Readonly<{
	primaryUnifiedContentId: string | null;
	photoTotal: number;
}>;

/** UI state omitting `'idle'` (unknown key in the map covers that). */
export type ListingCoverEntry =
	| { kind: 'loading' }
	| ({ kind: 'ready' } & ListingCoverResolved);

export function useListingPrimaryUnifiedContentIds(
	propertyIds: readonly string[],
	listingMediaRefreshAt: number | undefined,
	eagerFetchPropertyIds: readonly string[] = []
): Readonly<{
	coverStates: Readonly<Record<string, ListingCoverEntry>>;
	registerListingCoverInterest: (propertyId: string) => void;
	selectedCoverPending: (
		selectedPropertyId: string | null | undefined
	) => boolean;
}> {
	const allowedIdsRef = useRef(new Set(propertyIds));
	allowedIdsRef.current = new Set(propertyIds);

	const allowedIdsKey = useMemo(
		() =>
			[...new Set(propertyIds)]
				.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
				.join('\0'),
		[propertyIds]
	);
	const eagerKey = useMemo(
		() =>
			[
				...new Set(
					eagerFetchPropertyIds
						.map((id) => String(id ?? '').trim())
						.filter(Boolean)
				),
			]
				.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
				.join(','),
		[eagerFetchPropertyIds]
	);

	const generationRef = useRef(0);
	const inFlightRef = useRef(new Set<string>());
	const [coverStates, setCoverStates] = useState<
		Record<string, ListingCoverEntry>
	>({});

	const bumpGenerationAndClearCache = useCallback(() => {
		generationRef.current += 1;
		inFlightRef.current.clear();
		setCoverStates({});
	}, []);

	const prevListingMediaRevRef = useRef<number | null>(null);
	useLayoutEffect(() => {
		const rev = listingMediaRefreshAt ?? 0;
		if (prevListingMediaRevRef.current === null) {
			prevListingMediaRevRef.current = rev;
			return;
		}
		if (prevListingMediaRevRef.current === rev) return;
		prevListingMediaRevRef.current = rev;
		bumpGenerationAndClearCache();
	}, [bumpGenerationAndClearCache, listingMediaRefreshAt]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: prune when normalized id roster changes (`allowedIdsKey` tracks roster membership)
	useLayoutEffect(() => {
		const allowed = allowedIdsRef.current;
		setCoverStates((previous) => {
			let mutated = false;
			const next: Record<string, ListingCoverEntry> = { ...previous };
			for (const existingId of Object.keys(next)) {
				if (!allowed.has(existingId)) {
					delete next[existingId];
					mutated = true;
				}
			}
			return mutated ? next : previous;
		});
	}, [allowedIdsKey]);

	const runFetch = useCallback(async (propertyIdRaw: string) => {
		const propertyId = String(propertyIdRaw).trim();
		if (!propertyId) return;

		const allowedIds = allowedIdsRef.current;
		if (!allowedIds.has(propertyId)) return;
		if (inFlightRef.current.has(propertyId)) return;

		const capturedGeneration = generationRef.current;
		inFlightRef.current.add(propertyId);

		setCoverStates((previous) =>
			previous[propertyId]?.kind === 'ready'
				? previous
				: {
						...previous,
						[propertyId]: { kind: 'loading' },
					}
		);

		try {
			const rows = await listRealtorPropertyMedia(propertyId);
			const total =
				Array.isArray(rows) && typeof rows === 'object' ? rows.length : 0;
			const unified = rows?.[0]?.unified_content_id;
			const primaryUnifiedContentId =
				unified !== null &&
				unified !== undefined &&
				String(unified).trim().length > 0
					? String(unified).trim()
					: null;
			const patch: ListingCoverResolved = {
				primaryUnifiedContentId,
				photoTotal: total,
			};

			if (
				generationRef.current !== capturedGeneration ||
				!allowedIdsRef.current.has(propertyId)
			) {
				return;
			}

			setCoverStates((previous) => ({
				...previous,
				[propertyId]: { kind: 'ready', ...patch },
			}));
		} catch {
			if (
				generationRef.current !== capturedGeneration ||
				!allowedIdsRef.current.has(propertyId)
			) {
				return;
			}
			setCoverStates((previous) => ({
				...previous,
				[propertyId]: {
					kind: 'ready',
					primaryUnifiedContentId: null,
					photoTotal: 0,
				},
			}));
		} finally {
			inFlightRef.current.delete(propertyId);
		}
	}, []);

	const registerListingCoverInterest = useCallback(
		(propertyIdRaw: string) => {
			const propertyId = String(propertyIdRaw).trim();
			if (!propertyId || !allowedIdsRef.current.has(propertyId)) return;
			void runFetch(propertyId);
		},
		[runFetch]
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: rerun eager prefetch when media revision clears cache (deps include `listingMediaRefreshAt`)
	useLayoutEffect(() => {
		const eagerLocal = eagerKey.length
			? eagerKey.split(',').filter(Boolean)
			: [];
		const allowed = allowedIdsRef.current;
		for (const id of eagerLocal) {
			if (!allowed.has(id)) continue;
			void runFetch(id);
		}
	}, [allowedIdsKey, eagerKey, listingMediaRefreshAt, runFetch]);

	const selectedCoverPending = useCallback(
		(selectedPropertyId: string | null | undefined) => {
			if (!selectedPropertyId) return false;
			const entry = coverStates[selectedPropertyId];
			return entry === undefined || entry.kind !== 'ready';
		},
		[coverStates]
	);

	return useMemo(
		() => ({
			coverStates,
			registerListingCoverInterest,
			selectedCoverPending,
		}),
		[coverStates, registerListingCoverInterest, selectedCoverPending]
	);
}
