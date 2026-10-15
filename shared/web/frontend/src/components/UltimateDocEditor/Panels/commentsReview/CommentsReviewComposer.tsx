/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * New-comment composer with selection context, mention suggestions, and submit.
 *
 * Related:
 * - useCommentMentions.ts, commentsReviewConstants.ts
 */

import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { RefObject } from 'react';

import { Input } from '@/components/atoms/Input';
import { cn } from '@/utils/cn';
import { DESKTOP_DOC_INPUT_CHROME } from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewConstants';
import type {
	MentionCandidate,
	ThreadSelection,
} from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewTypes';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

export interface CommentsReviewComposerProps {
	t: TFunction;
	composerSelection: ThreadSelection | null;
	onClearComposerSelection: () => void;
	onJumpToSelection?: (selection: ThreadSelection) => void;
	onFocusThread?: (threadId: string | null) => void;
	newComment: string;
	onNewCommentChange: (value: string) => void;
	onNewCommentFocusMention: () => void;
	onSubmit: () => void;
	canWriteComments: boolean;
	newCommentInputRef: RefObject<HTMLInputElement | null>;
	activeMentionTarget: 'comment' | 'reply' | null;
	mentionSuggestions: MentionCandidate[];
	onApplyMentionSuggestion: (candidate: MentionCandidate) => void;
}

export function CommentsReviewComposer({
	t,
	composerSelection,
	onClearComposerSelection,
	onJumpToSelection,
	onFocusThread,
	newComment,
	onNewCommentChange,
	onNewCommentFocusMention,
	onSubmit,
	canWriteComments,
	newCommentInputRef,
	activeMentionTarget,
	mentionSuggestions,
	onApplyMentionSuggestion,
}: CommentsReviewComposerProps) {
	return (
		<div className="border-b border-(--desktop-border-subtle) p-4">
			<div className="space-y-3">
				{composerSelection ? (
					<div className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-3">
						<div className="mb-2 flex items-start justify-between gap-2">
							<div className="text-xs text-blue-200">
								{t('comments.composer.selectedRange', {
									start: composerSelection.start,
									end: composerSelection.end,
								})}
							</div>
							<div className="flex items-center gap-2">
								{onJumpToSelection ? (
									<DesktopAppButton
										onClick={() => {
											onFocusThread?.(null);
											onJumpToSelection(composerSelection);
										}}
										variant="ghost"
										size="sm"
									>
										{t('comments.composer.jumpToFragment')}
									</DesktopAppButton>
								) : null}
								<DesktopAppButton
									onClick={onClearComposerSelection}
									variant="ghost"
									size="sm"
								>
									{t('comments.composer.generalThread')}
								</DesktopAppButton>
							</div>
						</div>
						<div className="text-sm italic text-(--desktop-text-primary)">
							"{composerSelection.text}"
						</div>
					</div>
				) : (
					<p className="text-xs leading-relaxed text-(--desktop-text-muted)">
						{t('comments.composer.hint')}
					</p>
				)}

				<div className="flex gap-2">
					<Input
						ref={newCommentInputRef}
						type="text"
						placeholder={
							composerSelection
								? t('comments.composer.placeholderSelection')
								: t('comments.composer.placeholderGeneral')
						}
						value={newComment}
						onChange={(e) => {
							onNewCommentChange(e.target.value);
							onNewCommentFocusMention();
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								onSubmit();
							}
						}}
						className={cn(
							DESKTOP_DOC_INPUT_CHROME,
							'flex-1 focus-visible:border-blue-400/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400/30'
						)}
						disabled={!canWriteComments}
					/>
					<DesktopAppButton
						onClick={onSubmit}
						disabled={!canWriteComments || !newComment.trim()}
						variant="accent"
						size="icon"
					>
						<PaperAirplaneIcon width={16} height={16} />
					</DesktopAppButton>
				</div>
				{activeMentionTarget === 'comment' && mentionSuggestions.length > 0 ? (
					<div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-2">
						{mentionSuggestions.map((candidate) => (
							<DesktopAppButton
								key={candidate.handle}
								onClick={() => onApplyMentionSuggestion(candidate)}
								variant="ghost"
								size="sm"
							>
								@{candidate.handle}
							</DesktopAppButton>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}
