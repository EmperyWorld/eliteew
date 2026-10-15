/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsible sidebar for older chat messages beyond the visible window.
 *
 * Invariants:
 * - Renders nothing when olderMessages is empty.
 * - Sticky prompt above fold when details closed (R10).
 * - Older message bubbles mount only while details is open.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantChatMessageList.tsx
 */
import { cn } from '@/utils/cn';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type { AssistantChatMessage } from '../../services/productDesktopApi';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '../DesktopAppChrome';
import {
	ASSISTANT_HISTORY_DETAILS_CLASS,
	ASSISTANT_HISTORY_DETAILS_SUMMARY_OPEN_CLASS,
	ASSISTANT_HISTORY_DETAILS_SUMMARY_READY_CLASS,
} from './assistantChatPanelStyles';
import { ASSISTANT_FAQ_COUNT_BADGE_CLASS } from './assistantFaqPanelStyles';

export type AssistantChatHistorySidebarProps = {
	olderMessages: AssistantChatMessage[];
	t: TFunction<'desktopUi', 'assistant'>;
	renderMessage: (message: AssistantChatMessage) => ReactNode;
};

export function AssistantChatHistorySidebar({
	olderMessages,
	t,
	renderMessage,
}: AssistantChatHistorySidebarProps): React.ReactElement | null {
	const detailsRef = React.useRef<HTMLDetailsElement | null>(null);
	const [historyOpen, setHistoryOpen] = React.useState(false);

	if (olderMessages.length === 0) return null;

	return (
		<>
			{!historyOpen ? (
				<div
					className="sticky top-0 z-2 -mx-1 mb-2 border-b border-(--desktop-border-subtle)/40 bg-[color-mix(in_srgb,var(--desktop-surface-app)_92%,transparent)] px-1 py-1.5 backdrop-blur-xs"
					data-assistant-guide="history-sticky-prompt"
				>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							'w-full justify-start gap-2',
							ASSISTANT_HISTORY_DETAILS_SUMMARY_READY_CLASS
						)}
						onClick={() => {
							if (detailsRef.current) {
								detailsRef.current.open = true;
								setHistoryOpen(true);
							}
						}}
					>
						<ChevronDownIcon
							className="h-4 w-4 shrink-0 text-(--desktop-accent)"
							aria-hidden
						/>
						<span
							className={cn(
								DESKTOP_TYPOGRAPHY.small,
								'font-medium text-(--desktop-accent)'
							)}
						>
							{t('loadMoreHistory', { count: olderMessages.length })}
						</span>
					</DesktopAppButton>
				</div>
			) : null}
			<details
				ref={detailsRef}
				className={cn(ASSISTANT_HISTORY_DETAILS_CLASS, 'group/history')}
				data-assistant-guide="history-sidebar"
				onToggle={(e) => setHistoryOpen(e.currentTarget.open)}
			>
				<summary
					className={cn(
						'cursor-pointer list-none px-3 py-2.5 flex items-center gap-2',
						DESKTOP_TYPOGRAPHY.small,
						'text-(--desktop-text-primary)',
						'[&::-webkit-details-marker]:hidden',
						DESKTOP_CHROME_FOCUS_VISIBLE,
						'rounded-t-lg',
						ASSISTANT_HISTORY_DETAILS_SUMMARY_OPEN_CLASS,
						ASSISTANT_HISTORY_DETAILS_SUMMARY_READY_CLASS
					)}
				>
					<ChevronDownIcon
						className="h-4 w-4 shrink-0 text-(--desktop-accent) transition-transform duration-200 group-open/history:rotate-180 motion-reduce:transition-none"
						aria-hidden
					/>
					<span className="min-w-0 flex-1 flex items-center gap-2">
						<span className="text-(--desktop-accent) font-medium">
							{t('loadMoreHistory', { count: olderMessages.length })}
						</span>
						<span
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'rounded-full border px-2 py-0.5 tabular-nums',
								ASSISTANT_FAQ_COUNT_BADGE_CLASS
							)}
						>
							{olderMessages.length}
						</span>
					</span>
				</summary>
				{historyOpen ? (
					<div
						className="space-y-3 px-3 pt-1 border-t border-(--desktop-border-subtle)"
						data-testid="assistant-history-older-messages"
					>
						{olderMessages.map((m) => renderMessage(m))}
					</div>
				) : null}
			</details>
		</>
	);
}
