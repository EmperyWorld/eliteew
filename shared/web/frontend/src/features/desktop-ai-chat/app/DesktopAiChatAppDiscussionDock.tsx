/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Discussion Process dock inside the chat column: live bubble or reopen control.
 *
 * Invariants:
 * - closedDiscussionPanelKeys only hides the Process UI; it does not finish/cancel.
 *
 * Related:
 * - discussion/DiscussionBubble.tsx, documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
 */
import * as React from 'react';
import { DESKTOP_INTERACTIVE } from '../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DiscussionBubble } from '../discussion';
import { persistChatDraft } from '../utils/desktopAiChatDraft';
import type { DesktopAiChatAppComposeResult } from './useDesktopAiChatAppCompose';

type DesktopAiChatAppDiscussionDockProps = {
	vm: DesktopAiChatAppComposeResult;
};

export function DesktopAiChatAppDiscussionDock({
	vm,
}: DesktopAiChatAppDiscussionDockProps): React.ReactElement | null {
	const { t, activeId, input, setInput, discussion } = vm;
	const [closedDiscussionPanelKeys, setClosedDiscussionPanelKeys] =
		React.useState(() => new Set<string>());
	const discussionPanelKey = `${activeId ?? ''}:${discussion.session?.id ?? ''}`;
	const discussionPanelOpen =
		Boolean(discussion.session) &&
		!closedDiscussionPanelKeys.has(discussionPanelKey);

	if (!discussion.session) {
		return null;
	}

	if (discussionPanelOpen) {
		return (
			<div className="px-3 pb-2">
				<DiscussionBubble
					session={discussion.session}
					controls={discussion.controls}
					busy={discussion.busy}
					liveDegraded={discussion.liveMode === 'poll'}
					onClosePanel={() =>
						setClosedDiscussionPanelKeys((prev) => {
							const next = new Set(prev);
							next.add(discussionPanelKey);
							return next;
						})
					}
					onRaiseHand={() => void discussion.raiseHand()}
					onContinue={() => void discussion.continueDiscussion()}
					onFinish={() => void discussion.finish()}
					onCancel={() => void discussion.cancel()}
					onGenerateDocument={() => void discussion.generateDocument()}
					composerSlot={
						discussion.controls.composerEnabled ? (
							<div className="mt-3 flex gap-2">
								<textarea
									value={input}
									onChange={(e) => setInput(e.target.value)}
									rows={2}
									className="min-w-0 flex-1 rounded-lg border border-(--desktop-border-subtle) bg-transparent px-3 py-2 text-sm"
									placeholder={t('discussionInterjectionPlaceholder')}
								/>
								<button
									type="button"
									disabled={discussion.busy || !input.trim()}
									className="rounded-md bg-[rgb(var(--desktop-accent-rgb))] px-3 py-2 text-sm text-white disabled:opacity-50"
									onClick={() => {
										const text = input.trim();
										if (!text) return;
										void discussion.interject(text).then((res) => {
											if (res) {
												setInput('');
												if (activeId) persistChatDraft(activeId, '');
											}
										});
									}}
								>
									{t('discussionSendInterjection')}
								</button>
							</div>
						) : null
					}
				/>
			</div>
		);
	}

	return (
		<div className="px-3 pb-2">
			<button
				type="button"
				className={cn(
					'w-full rounded-lg border border-(--desktop-border-subtle) px-3 py-2 text-left text-sm text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)',
					DESKTOP_INTERACTIVE.btnRounded
				)}
				onClick={() =>
					setClosedDiscussionPanelKeys((prev) => {
						const next = new Set(prev);
						next.delete(discussionPanelKey);
						return next;
					})
				}
				data-testid="discussion-panel-reopen"
			>
				{t('discussionPanelReopen')}
			</button>
		</div>
	);
}
