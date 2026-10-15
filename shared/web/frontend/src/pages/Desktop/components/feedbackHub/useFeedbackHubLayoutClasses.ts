/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Memoized shell-frame layout class names for Feedback Hub list and compose surfaces.
 *
 * Invariants:
 * - Recomputes when desktop shell frame changes; no fetch or i18n side effects.
 *
 * Related:
 * - FeedbackHubApp.tsx · feedbackHubLayoutTokens.ts
 */
import * as React from 'react';
import { useDesktopShellFrame } from '../../context/DesktopShellFrameContext';
import {
	buildFeedbackHubHeaderStripClass,
	buildFeedbackHubKindToggleClusterClass,
	buildFeedbackHubListSearchInputClass,
	buildFeedbackHubListToolbarClusterClass,
	buildFeedbackHubSendActionBarClass,
} from './feedbackHubLayoutTokens';

export type FeedbackHubLayoutClasses = {
	feedbackHeaderStripClass: string;
	listToolbarClusterClass: string;
	listSearchInputClass: string;
	kindToggleClusterClass: string;
	sendActionBarClass: string;
};

export function useFeedbackHubLayoutClasses(): FeedbackHubLayoutClasses {
	const shellFrame = useDesktopShellFrame();
	return React.useMemo(
		() => ({
			feedbackHeaderStripClass: buildFeedbackHubHeaderStripClass(shellFrame),
			listToolbarClusterClass:
				buildFeedbackHubListToolbarClusterClass(shellFrame),
			listSearchInputClass: buildFeedbackHubListSearchInputClass(shellFrame),
			kindToggleClusterClass:
				buildFeedbackHubKindToggleClusterClass(shellFrame),
			sendActionBarClass: buildFeedbackHubSendActionBarClass(shellFrame),
		}),
		[shellFrame]
	);
}
