/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React hook for `<audio>`/`<video>` ticket URLs — one secure backend re-mint on media error.
 *
 * Invariants:
 * - Single remint attempt per src lifecycle; 403/401 from ticket POST is terminal (access denied UI).
 * - Re-mint only when contentId matches the active media item (no privilege pivot).
 *
 * Related:
 * - services/auth/secureMediaTicketRemint.ts
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
	buildSecureMediaTicketRemintContext,
	isContentTicketStreamUrl,
	secureRemintContentInlineStreamUrl,
} from '@/services/auth/secureMediaTicketRemint';

export type UseSecureTicketMediaSrcOptions = {
	initialUrl: string;
	contentId: string;
	version?: string | null;
};

export function useSecureTicketMediaSrc(
	options: UseSecureTicketMediaSrcOptions
): {
	mediaSrc: string;
	accessDenied: boolean;
	onMediaError: () => void;
} {
	const [mediaSrc, setMediaSrc] = useState(options.initialUrl);
	const [accessDenied, setAccessDenied] = useState(false);
	const remintAttemptedRef = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset remint guard when content or URL changes
	useEffect(() => {
		setMediaSrc(options.initialUrl);
		setAccessDenied(false);
		remintAttemptedRef.current = false;
	}, [options.contentId, options.initialUrl]);

	const onMediaError = useCallback(() => {
		if (remintAttemptedRef.current || accessDenied) {
			return;
		}
		if (!isContentTicketStreamUrl(mediaSrc)) {
			return;
		}
		const ctx = buildSecureMediaTicketRemintContext(
			mediaSrc,
			options.contentId
		);
		if (!ctx) {
			return;
		}
		remintAttemptedRef.current = true;
		void secureRemintContentInlineStreamUrl(ctx).then((result) => {
			if (result.ok) {
				setMediaSrc(result.streamUrl);
				return;
			}
			if (result.terminal) {
				setAccessDenied(true);
			}
		});
	}, [accessDenied, mediaSrc, options.contentId]);

	return { mediaSrc, accessDenied, onMediaError };
}
