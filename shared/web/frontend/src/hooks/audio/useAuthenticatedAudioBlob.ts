/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reusable hook for authenticated audio blob download with built-in abort handling.
 *
 * Invariants:
 * - At most one active fetch per hook instance; starting a new request aborts the previous.
 * - Download URL contract is centralized and always uses inline disposition.
 *
 * Related:
 * - src/services/contentDownloadWithRetry.ts
 * - src/services/audio/playerAudioContracts.ts
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchContentDownloadBlobWithRetry } from '@/services/contentDownloadWithRetry';

export interface FetchAuthenticatedAudioBlobArgs {
	unifiedContentId: string;
	version?: string | null;
	maxAttempts?: number;
	initialDelayMs?: number;
}

export interface UseAuthenticatedAudioBlobResult {
	isFetching: boolean;
	fetchAudioBlob: (args: FetchAuthenticatedAudioBlobArgs) => Promise<Blob>;
	abortInFlightFetch: () => void;
}

export function useAuthenticatedAudioBlob(): UseAuthenticatedAudioBlobResult {
	const [isFetching, setIsFetching] = useState(false);
	const abortRef = useRef<AbortController | null>(null);

	const abortInFlightFetch = useCallback(() => {
		if (abortRef.current) {
			abortRef.current.abort();
			abortRef.current = null;
		}
		setIsFetching(false);
	}, []);

	const fetchAudioBlob = useCallback(
		async ({
			unifiedContentId,
			version,
			maxAttempts = 8,
			initialDelayMs = 400,
		}: FetchAuthenticatedAudioBlobArgs): Promise<Blob> => {
			const trimmedId = unifiedContentId.trim();
			if (!trimmedId) {
				throw new Error('EMPTY_CONTENT_ID');
			}
			abortInFlightFetch();
			const controller = new AbortController();
			abortRef.current = controller;
			setIsFetching(true);
			try {
				return await fetchContentDownloadBlobWithRetry(
					trimmedId,
					{
						disposition: 'inline',
						v: version ?? undefined,
					},
					{
						signal: controller.signal,
						maxAttempts,
						initialDelayMs,
					}
				);
			} finally {
				if (abortRef.current === controller) {
					abortRef.current = null;
					setIsFetching(false);
				}
			}
		},
		[abortInFlightFetch]
	);

	useEffect(() => abortInFlightFetch, [abortInFlightFetch]);

	return {
		isFetching,
		fetchAudioBlob,
		abortInFlightFetch,
	};
}
