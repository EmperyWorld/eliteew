/**
 * Сессия комментариев / review: треды, deep-link по hash, якоря, переход к выделению.
 */

import type { Editor } from '@tiptap/react';
import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react';
import { log } from '../../../utils/logger';
import type {
	CommentAnchorMeta,
	CommentAnchorRange,
	CommentThread,
	CommentThreadAction,
	ExternalCommentThreadAction,
} from '../types/editor.types';
import type { DocEditorSelectionRange } from '../utils/runtimeDialogEvents';
import {
	clearThreadParamInHash,
	parseThreadIdFromHash,
} from '../utils/threadHashLink';

export interface UseDocEditorCommentsSessionParams {
	tiptapEditor: Editor | null;
	setSelectedText: (text: string) => void;
	setEditorSelectionRange: Dispatch<
		SetStateAction<DocEditorSelectionRange | null>
	>;
	setCommentsPanelOpen: Dispatch<SetStateAction<boolean>>;
}

export interface UseDocEditorCommentsSessionResult {
	commentJumpFlashToken: number;
	activeCommentThreadId: string | null;
	setActiveCommentThreadId: Dispatch<SetStateAction<string | null>>;
	commentThreads: CommentThread[];
	setCommentThreads: Dispatch<SetStateAction<CommentThread[]>>;
	externalThreadAction: ExternalCommentThreadAction | null;
	handleJumpToCommentSelection: (selection: {
		start: number;
		end: number;
		text: string;
	}) => void;
	openThreadById: (threadId: string) => void;
	handleCommentAnchorAction: (payload: {
		threadId: string;
		action: CommentThreadAction;
	}) => void;
	handleExternalThreadActionHandled: (token: number) => void;
	commentAnchorRanges: CommentAnchorRange[];
	commentAnchorMeta: Record<string, CommentAnchorMeta>;
	resetCommentsSession: () => void;
}

export function useDocEditorCommentsSession(
	params: UseDocEditorCommentsSessionParams
): UseDocEditorCommentsSessionResult {
	const {
		tiptapEditor,
		setSelectedText,
		setEditorSelectionRange,
		setCommentsPanelOpen,
	} = params;

	const [commentJumpFlashToken, setCommentJumpFlashToken] = useState(0);
	const [activeCommentThreadId, setActiveCommentThreadId] = useState<
		string | null
	>(null);
	const [pendingThreadFromHash, setPendingThreadFromHash] = useState<
		string | null
	>(null);
	const [externalThreadAction, setExternalThreadAction] =
		useState<ExternalCommentThreadAction | null>(null);
	const [commentThreads, setCommentThreads] = useState<CommentThread[]>([]);

	const resetCommentsSession = useCallback((): void => {
		setActiveCommentThreadId(null);
		setCommentThreads([]);
		setPendingThreadFromHash(null);
		setExternalThreadAction(null);
		setCommentJumpFlashToken(0);
	}, []);

	const handleJumpToCommentSelection = useCallback(
		(selection: { start: number; end: number; text: string }): void => {
			if (!tiptapEditor) {
				return;
			}

			try {
				const maxPos = Math.max(1, tiptapEditor.state.doc.content.size);
				const from = Math.min(Math.max(1, selection.start), maxPos);
				const to = Math.min(Math.max(from, selection.end), maxPos);

				setSelectedText(selection.text);
				setEditorSelectionRange({ from, to });
				tiptapEditor.chain().focus().setTextSelection({ from, to }).run();
				setCommentJumpFlashToken((prev) => prev + 1);
			} catch (error) {
				log.warn(
					'UltimateDocEditor',
					'Failed to jump to comment selection',
					error
				);
			}
		},
		[tiptapEditor, setSelectedText, setEditorSelectionRange]
	);

	const openThreadById = useCallback(
		(threadId: string): void => {
			setActiveCommentThreadId(threadId);
			setCommentsPanelOpen(true);

			const thread = commentThreads.find((item) => item.id === threadId);
			if (thread?.selection) {
				handleJumpToCommentSelection(thread.selection);
			}
		},
		[commentThreads, handleJumpToCommentSelection, setCommentsPanelOpen]
	);

	const handleCommentAnchorAction = useCallback(
		(payload: { threadId: string; action: CommentThreadAction }): void => {
			const { threadId, action } = payload;
			openThreadById(threadId);

			if (action === 'reply' || action === 'resolve') {
				setExternalThreadAction({
					threadId,
					action,
					token: Date.now(),
				});
			}
		},
		[openThreadById]
	);

	useEffect(() => {
		const syncThreadFromHash = (): void => {
			const threadId = parseThreadIdFromHash(window.location.hash);
			if (!threadId) {
				return;
			}
			setPendingThreadFromHash(threadId);
			setActiveCommentThreadId(threadId);
			setCommentsPanelOpen(true);
		};

		syncThreadFromHash();
		window.addEventListener('hashchange', syncThreadFromHash);
		return () => {
			window.removeEventListener('hashchange', syncThreadFromHash);
		};
	}, [setCommentsPanelOpen]);

	useEffect(() => {
		if (!pendingThreadFromHash || commentThreads.length === 0) {
			return;
		}

		const thread = commentThreads.find(
			(item) => item.id === pendingThreadFromHash
		);
		if (!thread) {
			const nextHash = clearThreadParamInHash(window.location.hash);
			if (nextHash !== window.location.hash) {
				window.history.replaceState(window.history.state, '', nextHash);
			}
			setPendingThreadFromHash(null);
			setActiveCommentThreadId(null);
			log.warn(
				'UltimateDocEditor',
				`Thread deep-link not found: ${pendingThreadFromHash}`
			);
			return;
		}

		if (thread.selection) {
			handleJumpToCommentSelection(thread.selection);
		}

		const nextHash = clearThreadParamInHash(window.location.hash);
		if (nextHash !== window.location.hash) {
			window.history.replaceState(window.history.state, '', nextHash);
		}
		setPendingThreadFromHash(null);
	}, [commentThreads, handleJumpToCommentSelection, pendingThreadFromHash]);

	const handleExternalThreadActionHandled = useCallback(
		(token: number): void => {
			setExternalThreadAction((current) => {
				if (!current || current.token !== token) {
					return current;
				}
				return null;
			});
		},
		[]
	);

	const commentAnchorRanges = useMemo<CommentAnchorRange[]>(
		() =>
			commentThreads.flatMap((thread) => {
				const selection = thread.selection;
				if (!selection || selection.start >= selection.end) {
					return [];
				}
				const unresolved = thread.comments.some((comment) => !comment.resolved);
				const anchor: CommentAnchorRange = {
					threadId: thread.id,
					start: selection.start,
					end: selection.end,
					resolved: !unresolved,
				};
				return [anchor];
			}),
		[commentThreads]
	);

	const commentAnchorMeta = useMemo<Record<string, CommentAnchorMeta>>(() => {
		return commentThreads.reduce<Record<string, CommentAnchorMeta>>(
			(acc, thread) => {
				const totalComments = thread.comments.length;
				const unresolvedComments = thread.comments.filter(
					(comment) => !comment.resolved
				).length;
				acc[thread.id] = {
					threadId: thread.id,
					totalComments,
					unresolvedComments,
				};
				return acc;
			},
			{}
		);
	}, [commentThreads]);

	return {
		commentJumpFlashToken,
		activeCommentThreadId,
		setActiveCommentThreadId,
		commentThreads,
		setCommentThreads,
		externalThreadAction,
		handleJumpToCommentSelection,
		openThreadById,
		handleCommentAnchorAction,
		handleExternalThreadActionHandled,
		commentAnchorRanges,
		commentAnchorMeta,
		resetCommentsSession,
	};
}
