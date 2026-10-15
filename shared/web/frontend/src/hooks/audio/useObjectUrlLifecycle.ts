/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared object URL lifecycle hook used by audio preview and now-playing flows.
 *
 * Invariants:
 * - Previously issued object URL is revoked before creating a new one.
 * - Cleanup on unmount always revokes the latest issued object URL.
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 * - src/components/Audio/AuthenticatedAudioPreview.tsx
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ManagedObjectUrl {
	objectUrl: string | null;
	setBlob: (blob: Blob | null) => string | null;
	revoke: () => void;
}

export function useObjectUrlLifecycle(): ManagedObjectUrl {
	const [objectUrl, setObjectUrl] = useState<string | null>(null);
	const objectUrlRef = useRef<string | null>(null);

	const revoke = useCallback(() => {
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = null;
		}
		setObjectUrl(null);
	}, []);

	const setBlob = useCallback(
		(blob: Blob | null): string | null => {
			revoke();
			if (!blob || blob.size <= 0) {
				return null;
			}
			const nextUrl = URL.createObjectURL(blob);
			objectUrlRef.current = nextUrl;
			setObjectUrl(nextUrl);
			return nextUrl;
		},
		[revoke]
	);

	useEffect(() => revoke, [revoke]);

	return { objectUrl, setBlob, revoke };
}
