/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * sessionStorage dismiss/restore for the sticky load-older banner (per active chat).
 *
 * Invariants:
 * - Key scoped by activeId; blocked sessionStorage degrades to in-memory only.
 *
 * Related:
 * - DesktopAiChatLoadOlderBanner.tsx
 */
import * as React from 'react';

export function useDesktopAiChatLoadOlderBanner(activeId: string | null): {
	loadOlderBannerDismissed: boolean;
	dismissLoadOlderBanner: () => void;
	restoreLoadOlderBanner: () => void;
} {
	const loadOlderDismissStorageKey = React.useMemo(
		() =>
			activeId
				? `eliteew.desktopAiChat.loadOlderBannerDismissed.v1:${activeId}`
				: null,
		[activeId]
	);
	const [loadOlderBannerDismissed, setLoadOlderBannerDismissed] =
		React.useState(false);

	React.useEffect(() => {
		if (!loadOlderDismissStorageKey) {
			setLoadOlderBannerDismissed(false);
			return;
		}
		try {
			setLoadOlderBannerDismissed(
				sessionStorage.getItem(loadOlderDismissStorageKey) === '1'
			);
		} catch {
			setLoadOlderBannerDismissed(false);
		}
	}, [loadOlderDismissStorageKey]);

	const dismissLoadOlderBanner = React.useCallback(() => {
		setLoadOlderBannerDismissed(true);
		if (!loadOlderDismissStorageKey) return;
		try {
			sessionStorage.setItem(loadOlderDismissStorageKey, '1');
		} catch {
			/* sessionStorage may be blocked */
		}
	}, [loadOlderDismissStorageKey]);

	const restoreLoadOlderBanner = React.useCallback(() => {
		setLoadOlderBannerDismissed(false);
		if (!loadOlderDismissStorageKey) return;
		try {
			sessionStorage.removeItem(loadOlderDismissStorageKey);
		} catch {
			/* sessionStorage may be blocked */
		}
	}, [loadOlderDismissStorageKey]);

	return {
		loadOlderBannerDismissed,
		dismissLoadOlderBanner,
		restoreLoadOlderBanner,
	};
}
