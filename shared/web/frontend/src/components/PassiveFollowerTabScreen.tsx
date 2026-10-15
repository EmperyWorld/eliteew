/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Passive UI for non-leader browser tabs — blocks full desktop/admin shell and API load.
 *
 * Invariants:
 * - No desktop providers or REST beyond this screen until user takes leadership.
 * - Visual + copy owned by `BrowserSingleTabGateScreen` (desktop tokens + commonUi i18n).
 *
 * Related:
 * - `contexts/BrowserTabLeaderProvider.tsx`, `documentation/platform/BUG-MULTI-TAB-BROWSER-PRESENCE-OPEN-2026-05-23.md`
 */

import type { FC } from 'react';
import { BrowserSingleTabGateScreen } from './browserTabGate/BrowserSingleTabGateScreen';

type PassiveFollowerTabScreenProps = {
	contextLabel?: string;
	onTakeLeadership: () => void;
};

export const PassiveFollowerTabScreen: FC<PassiveFollowerTabScreenProps> = ({
	contextLabel = 'EliteEW',
	onTakeLeadership,
}) => {
	return (
		<BrowserSingleTabGateScreen
			mode="follower"
			contextLabel={contextLabel}
			onTakeLeadership={onTakeLeadership}
		/>
	);
};
