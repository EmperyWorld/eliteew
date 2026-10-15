/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mention candidate list, active @-query, and suggestion apply for comment/reply inputs.
 *
 * Related:
 * - mentionUtils.ts, CommentsReviewComposer.tsx, CommentsReviewThreadCard.tsx
 */

import { useCallback, useMemo } from 'react';

import type {
	CommentAuthorOption,
	MentionCandidate,
	MentionTarget,
} from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewTypes';
import {
	applyMentionToText,
	normalizeMentionHandle,
	resolveActiveMentionQuery,
} from '@/components/UltimateDocEditor/Panels/commentsReview/mentionUtils';

export interface UseCommentMentionsParams {
	currentUser: { id: string; name: string };
	authorOptions: CommentAuthorOption[];
	activeMentionTarget: MentionTarget | null;
	newComment: string;
	replyText: string;
	setNewComment: (value: string) => void;
	setReplyText: (value: string) => void;
	setActiveMentionTarget: (target: MentionTarget | null) => void;
}

export function useCommentMentions({
	currentUser,
	authorOptions,
	activeMentionTarget,
	newComment,
	replyText,
	setNewComment,
	setReplyText,
	setActiveMentionTarget,
}: UseCommentMentionsParams) {
	const mentionCandidates = useMemo<MentionCandidate[]>(() => {
		const map = new Map<string, MentionCandidate>();

		const pushCandidate = (
			id: string | undefined,
			name: string | undefined
		): void => {
			if (!id || !name) {
				return;
			}
			const handle = normalizeMentionHandle(name) || normalizeMentionHandle(id);
			if (!handle || map.has(handle)) {
				return;
			}
			map.set(handle, { id, name, handle });
		};

		pushCandidate(currentUser.id, currentUser.name);
		authorOptions.forEach((author) => {
			pushCandidate(author.id, author.name);
		});

		return Array.from(map.values()).sort((a, b) =>
			a.name.localeCompare(b.name)
		);
	}, [authorOptions, currentUser.id, currentUser.name]);

	const activeMentionQuery = useMemo(() => {
		if (activeMentionTarget === 'reply') {
			return resolveActiveMentionQuery(replyText);
		}
		if (activeMentionTarget === 'comment') {
			return resolveActiveMentionQuery(newComment);
		}
		return null;
	}, [activeMentionTarget, newComment, replyText]);

	const mentionSuggestions = useMemo(() => {
		if (activeMentionQuery === null) {
			return [];
		}
		const query = activeMentionQuery.trim().toLowerCase();
		return mentionCandidates
			.filter((candidate) =>
				!query
					? true
					: candidate.handle.includes(query) ||
						candidate.name.toLowerCase().includes(query)
			)
			.slice(0, 6);
	}, [activeMentionQuery, mentionCandidates]);

	const applyMentionSuggestion = useCallback(
		(candidate: MentionCandidate): void => {
			const source = activeMentionTarget === 'reply' ? replyText : newComment;
			const next = applyMentionToText(source, candidate.handle);
			if (activeMentionTarget === 'reply') {
				setReplyText(next);
			} else {
				setNewComment(next);
			}
			setActiveMentionTarget(null);
		},
		[
			activeMentionTarget,
			newComment,
			replyText,
			setActiveMentionTarget,
			setNewComment,
			setReplyText,
		]
	);

	const threadMentionSuggestions = useMemo(
		() =>
			mentionSuggestions.map((candidate) => ({
				handle: candidate.handle,
				label: candidate.name,
			})),
		[mentionSuggestions]
	);

	return {
		mentionCandidates,
		mentionSuggestions,
		threadMentionSuggestions,
		applyMentionSuggestion,
	};
}
