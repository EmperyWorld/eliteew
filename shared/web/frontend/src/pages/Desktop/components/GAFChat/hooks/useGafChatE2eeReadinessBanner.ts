/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * E2EE readiness banner visibility and dismiss persistence for active GAF Chat threads.
 *
 * Invariants:
 * - Banner hidden when chat blocked, partner missing, E2EE ready, or user dismissed per chat.
 *
 * Related:
 * - GAFChatApp.tsx
 * - gafChatE2eeBannerPrefs.ts
 */
import { useCallback, useMemo, useState } from 'react';
import type { GafE2eeStatus } from '../api/gafChatApi';
import {
	isE2eeReadinessBannerDismissed,
	setE2eeReadinessBannerDismissed,
} from '../gafChatE2eeBannerPrefs';
import type { GAFChatPartner } from '../types';

export function useGafChatE2eeReadinessBanner(options: {
	myUserId: string | null;
	selectedChatId: string | null;
	partner: GAFChatPartner | null | undefined;
	chatBlocked: boolean;
	e2eeStatus: GafE2eeStatus | undefined;
}) {
	const { myUserId, selectedChatId, partner, chatBlocked, e2eeStatus } =
		options;
	const [dismissRevision, setDismissRevision] = useState(0);

	const showE2eeReadinessBanner = useMemo(() => {
		void dismissRevision;
		return Boolean(
			selectedChatId &&
				partner &&
				!chatBlocked &&
				e2eeStatus &&
				!e2eeStatus.ready &&
				!isE2eeReadinessBannerDismissed(myUserId, selectedChatId)
		);
	}, [
		selectedChatId,
		partner,
		chatBlocked,
		e2eeStatus,
		myUserId,
		dismissRevision,
	]);

	const onDismissE2eeReadinessBanner = useCallback(() => {
		if (myUserId && selectedChatId) {
			setE2eeReadinessBannerDismissed(myUserId, selectedChatId);
			setDismissRevision((n) => n + 1);
		}
	}, [myUserId, selectedChatId]);

	return { showE2eeReadinessBanner, onDismissE2eeReadinessBanner };
}
