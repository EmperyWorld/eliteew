/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public exports for Desktop AI Chat Discussion module.
 *
 * Invariants: — (нет)
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
 */
export { DiscussionBubble } from './DiscussionBubble';
export { DiscussionControlBar } from './DiscussionControlBar';
export { DiscussionProcessPanel } from './DiscussionProcessPanel';
export { DiscussionSetupSheet } from './DiscussionSetupSheet';
export {
	DiscussionSetupHost,
	useDiscussionSetupChatNav,
} from './DiscussionSetupHost';
export {
	discussionBlocksNormalChatSend,
	discussionControlVisibility,
} from './discussionControls';
export { shouldBlockChatSwitchForDiscussionSetup } from './discussionChatNavGuard';
export {
	isDesktopDiscussionAnchorMessage,
	latestDiscussionSessionIdFromMessages,
} from './discussionAnchors';
export { DISCUSSION_FALLBACK_PRESETS, DISCUSSION_PRESET_IDS } from './presets';
export {
	buildInterviewDiscussionStartInput,
	canShowInterviewHandoffCta,
	extractInterviewHandoff,
} from './interviewHandoff';
export { FreeformInterviewHandoffBar } from './FreeformInterviewHandoffBar';
export { DesktopAiInterviewHandoffStartButton } from './DesktopAiInterviewHandoffStartButton';
export { useDiscussionSession } from './useDiscussionSession';
export type {
	DiscussionControlVisibility,
	DiscussionPreset,
	DiscussionSession,
	DiscussionStatus,
	DiscussionTurn,
} from './types';
