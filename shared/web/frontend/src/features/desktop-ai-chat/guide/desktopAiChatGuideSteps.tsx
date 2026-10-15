/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop AI Chat guided-tour step ids, highlight selectors, and step icons.
 *
 * Invariants:
 * - highlightSelector values must match data-ai-chat-guide anchors in layout components.
 *
 * Related:
 * - features/desktop-ai-chat/DesktopAiChatGuideModal.tsx
 * - features/desktop-ai-chat/__tests__/desktopAiChat.guide-dom.test.ts
 */

import type { ComponentType, SVGProps } from 'react';
import {
	AdjustmentsHorizontalIcon,
	ChatBubbleLeftEllipsisIcon,
	ChatBubbleLeftRightIcon,
	PaperAirplaneIcon,
	SparklesIcon,
	UserCircleIcon,
} from '@heroicons/react/24/outline';

export type GuideStep = {
	id: string;
	highlightSelector: string | null;
};

export const STEP_IDS: GuideStep[] = [
	{ id: 'intro', highlightSelector: null },
	{ id: 'sidebar', highlightSelector: '[data-ai-chat-guide="sidebar"]' },
	{ id: 'thread', highlightSelector: '[data-ai-chat-guide="thread"]' },
	{ id: 'header', highlightSelector: '[data-ai-chat-guide="header-bar"]' },
	{
		id: 'settings',
		highlightSelector: '[data-ai-chat-guide="settings-panel"]',
	},
	{ id: 'composer', highlightSelector: '[data-ai-chat-guide="composer"]' },
	{ id: 'outro', highlightSelector: null },
];

export const STEP_ICON: Record<
	string,
	ComponentType<SVGProps<SVGSVGElement>>
> = {
	intro: SparklesIcon,
	sidebar: ChatBubbleLeftEllipsisIcon,
	thread: ChatBubbleLeftRightIcon,
	header: UserCircleIcon,
	settings: AdjustmentsHorizontalIcon,
	composer: PaperAirplaneIcon,
	outro: AdjustmentsHorizontalIcon,
};
