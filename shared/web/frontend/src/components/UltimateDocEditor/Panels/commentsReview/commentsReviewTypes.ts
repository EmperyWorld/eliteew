/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared prop and filter types for CommentsReviewPanel atomization modules.
 *
 * Invariants:
 * - Public CommentsReviewPanel props shape matches UltimateDocEditorPanelOverlays lazy import.
 *
 * Related:
 * - CommentsReviewPanel.tsx, useCommentsReviewCompose.ts
 */

import type {
	CommentThread,
	ExternalCommentThreadAction,
} from '@/components/UltimateDocEditor/types/editor.types';
import type { DocEditorSelectionRange } from '@/components/UltimateDocEditor/utils/runtimeDialogEvents';

export interface CommentsReviewPanelProps {
	isOpen: boolean;
	onClose: () => void;
	documentId?: string;
	selectedText?: string;
	selectionRange?: DocEditorSelectionRange | null;
	onJumpToSelection?: (
		selection: NonNullable<CommentThread['selection']>
	) => void;
	onThreadsChange?: (threads: CommentThread[]) => void;
	onFocusThread?: (threadId: string | null) => void;
	focusedThreadId?: string | null;
	externalThreadAction?: ExternalCommentThreadAction | null;
	onExternalThreadActionHandled?: (token: number) => void;
	currentUser?: {
		id: string;
		name: string;
		avatar?: string;
	};
	permissionRole?: 'owner' | 'reviewer' | 'viewer';
}

export type ThreadSelection = NonNullable<CommentThread['selection']>;

export interface MentionCandidate {
	id: string;
	name: string;
	handle: string;
}

export type MentionTarget = 'comment' | 'reply';

export type ThreadSortMode = 'recent' | 'oldest' | 'open_first';

export type ThreadQueueMode =
	| 'all'
	| 'assigned_to_me'
	| 'unresolved_in_selection'
	| 'recently_changed';

export type CommentPanelTab = 'comments' | 'review';

export type CommentAuthorOption = { id: string; name: string };

export type CommentReviewerOption = { id: string; name: string };
