/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Comment anchor decoration, jump flash, click capture, and quick-menu state for
 * Ultimate Doc Editor TipTap — coordinates with TiptapAnchorQuickMenu overlay.
 *
 * Invariants:
 * - Decoration meta dispatched via COMMENT_ANCHOR_PLUGIN_KEY transaction meta.
 * - Quick menu dismisses on outside pointerdown and Escape.
 *
 * Related:
 * - TiptapEditorInner.tsx, commentAnchorExtension.ts, TiptapAnchorQuickMenu.tsx
 */
import type { Editor } from '@tiptap/react';
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type MouseEvent,
	type RefObject,
} from 'react';
import i18n, { ULTIMATE_DOC_EDITOR_NS } from '../../../i18n/config';
import type {
	CommentAnchorMeta,
	CommentAnchorRange,
} from '../types/editor.types';
import { buildThreadDeepLink } from '../utils/threadHashLink';
import {
	COMMENT_ANCHOR_PLUGIN_KEY,
	type CommentAnchorDecorationMeta,
} from './commentAnchorExtension';
import { resolveGutterContentRoot } from './tiptapGutterDomContract';
import type { AnchorQuickMenuState } from './TiptapAnchorQuickMenu';

export interface UseTiptapCommentAnchorsOptions {
	editor: Editor | null;
	editorHostRef: RefObject<HTMLDivElement | null>;
	commentAnchors: CommentAnchorRange[];
	commentAnchorMeta: Record<string, CommentAnchorMeta>;
	activeCommentThreadId: string | null;
	commentJumpFlashToken?: string | number;
	documentId?: number | string | null;
	onCommentAnchorAction?: (payload: {
		threadId: string;
		action: 'open' | 'reply' | 'resolve';
	}) => void;
	onCommentAnchorClick?: (threadId: string) => void;
}

export interface UseTiptapCommentAnchorsResult {
	anchorQuickMenu: AnchorQuickMenuState | null;
	copiedThreadId: string | null;
	handleEditorClickCapture: (event: MouseEvent<HTMLDivElement>) => void;
	handleOpenAnchorThread: (threadId: string) => void;
	handleReplyAnchorThread: (threadId: string) => void;
	handleResolveAnchorThread: (threadId: string) => void;
	handleCopyThreadLink: (threadId: string) => Promise<void>;
	dismissAnchorQuickMenu: () => void;
}

export function useTiptapCommentAnchors({
	editor,
	editorHostRef,
	commentAnchors,
	commentAnchorMeta,
	activeCommentThreadId,
	commentJumpFlashToken,
	documentId,
	onCommentAnchorAction,
	onCommentAnchorClick,
}: UseTiptapCommentAnchorsOptions): UseTiptapCommentAnchorsResult {
	const [anchorQuickMenu, setAnchorQuickMenu] =
		useState<AnchorQuickMenuState | null>(null);
	const [copiedThreadId, setCopiedThreadId] = useState<string | null>(null);
	const copiedTimeoutRef = useRef<number | null>(null);
	const flashTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (flashTimeoutRef.current !== null) {
				window.clearTimeout(flashTimeoutRef.current);
			}
			if (copiedTimeoutRef.current !== null) {
				window.clearTimeout(copiedTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!editor) {
			return;
		}

		const transaction = editor.state.tr.setMeta(COMMENT_ANCHOR_PLUGIN_KEY, {
			anchors: commentAnchors,
			anchorMeta: commentAnchorMeta,
			activeThreadId: activeCommentThreadId,
		} satisfies CommentAnchorDecorationMeta);
		editor.view.dispatch(transaction);
	}, [activeCommentThreadId, commentAnchorMeta, commentAnchors, editor]);

	useEffect(() => {
		if (!commentJumpFlashToken) {
			return;
		}

		const root = resolveGutterContentRoot(
			editorHostRef.current
		) as HTMLElement | null;
		if (!root) {
			return;
		}

		root.classList.remove('comment-anchor-flash');
		void root.offsetWidth;
		root.classList.add('comment-anchor-flash');

		if (flashTimeoutRef.current !== null) {
			window.clearTimeout(flashTimeoutRef.current);
		}
		flashTimeoutRef.current = window.setTimeout(() => {
			root.classList.remove('comment-anchor-flash');
			flashTimeoutRef.current = null;
		}, 1300);
	}, [commentJumpFlashToken, editorHostRef]);

	const emitAnchorAction = useCallback(
		(threadId: string, action: 'open' | 'reply' | 'resolve'): void => {
			if (onCommentAnchorAction) {
				onCommentAnchorAction({ threadId, action });
			} else {
				onCommentAnchorClick?.(threadId);
			}
			setAnchorQuickMenu(null);
		},
		[onCommentAnchorAction, onCommentAnchorClick]
	);

	const handleOpenAnchorThread = useCallback(
		(threadId: string): void => {
			emitAnchorAction(threadId, 'open');
		},
		[emitAnchorAction]
	);

	const handleReplyAnchorThread = useCallback(
		(threadId: string): void => {
			emitAnchorAction(threadId, 'reply');
		},
		[emitAnchorAction]
	);

	const handleResolveAnchorThread = useCallback(
		(threadId: string): void => {
			emitAnchorAction(threadId, 'resolve');
		},
		[emitAnchorAction]
	);

	const handleCopyThreadLink = useCallback(
		async (threadId: string): Promise<void> => {
			const link = buildThreadDeepLink(window.location.href, threadId, {
				documentId:
					documentId == null || documentId === ''
						? undefined
						: String(documentId),
			});
			try {
				await navigator.clipboard.writeText(link);
				setCopiedThreadId(threadId);
				if (copiedTimeoutRef.current !== null) {
					window.clearTimeout(copiedTimeoutRef.current);
				}
				copiedTimeoutRef.current = window.setTimeout(() => {
					setCopiedThreadId((current) =>
						current === threadId ? null : current
					);
					copiedTimeoutRef.current = null;
				}, 1800);
			} catch {
				window.prompt(
					i18n.t(`${ULTIMATE_DOC_EDITOR_NS}:commentAnchors.promptCopyLink`),
					link
				);
			}
		},
		[documentId]
	);

	const handleEditorClickCapture = useCallback(
		(event: MouseEvent<HTMLDivElement>): void => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			const anchor = target.closest(
				'[data-comment-thread-id]'
			) as HTMLElement | null;
			if (!anchor) {
				return;
			}

			const threadId = anchor.dataset.commentThreadId;
			if (!threadId) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			setAnchorQuickMenu({
				threadId,
				x: event.clientX,
				y: event.clientY,
			});
		},
		[]
	);

	const dismissAnchorQuickMenu = useCallback(() => {
		setAnchorQuickMenu(null);
	}, []);

	useEffect(() => {
		if (!anchorQuickMenu) {
			return;
		}

		const handlePointerDown = (event: globalThis.MouseEvent): void => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			if (target.closest('[data-anchor-quick-menu="true"]')) {
				return;
			}

			setAnchorQuickMenu(null);
		};

		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				setAnchorQuickMenu(null);
			}
		};

		window.addEventListener('pointerdown', handlePointerDown);
		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('pointerdown', handlePointerDown);
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [anchorQuickMenu]);

	return {
		anchorQuickMenu,
		copiedThreadId,
		handleEditorClickCapture,
		handleOpenAnchorThread,
		handleReplyAnchorThread,
		handleResolveAnchorThread,
		handleCopyThreadLink,
		dismissAnchorQuickMenu,
	};
}
