/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Comment anchor quick-action overlay for Ultimate Doc Editor — open, reply,
 * resolve thread, and copy deep link from in-document anchor clicks.
 *
 * Invariants:
 * - Menu surface carries data-anchor-quick-menu for outside-click dismissal in parent.
 * - Resolve action disabled when thread has zero unresolved comments.
 *
 * Related:
 * - TiptapEditor.tsx, commentAnchorExtension.ts
 */
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '../../../i18n/config';
import {
	DesktopAppButton,
	DesktopAppMenuSurface,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import type { CommentAnchorMeta } from '../types/editor.types';

export interface AnchorQuickMenuState {
	threadId: string;
	x: number;
	y: number;
}

export interface TiptapAnchorQuickMenuProps {
	anchorQuickMenu: AnchorQuickMenuState;
	embeddedModalZContent: number;
	commentAnchorMeta: Record<string, CommentAnchorMeta>;
	copiedThreadId: string | null;
	onOpenThread: (threadId: string) => void;
	onReplyThread: (threadId: string) => void;
	onResolveThread: (threadId: string) => void;
	onCopyThreadLink: (threadId: string) => void;
	onDismiss: () => void;
}

export const TiptapAnchorQuickMenu: React.FC<TiptapAnchorQuickMenuProps> = ({
	anchorQuickMenu,
	embeddedModalZContent,
	commentAnchorMeta,
	copiedThreadId,
	onOpenThread,
	onReplyThread,
	onResolveThread,
	onCopyThreadLink,
	onDismiss,
}) => {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);

	return (
		<DesktopAppMenuSurface
			data-anchor-quick-menu="true"
			className="fixed min-w-[220px] p-2"
			style={{
				zIndex: embeddedModalZContent,
				left: Math.max(12, anchorQuickMenu.x + 10),
				top: Math.max(12, anchorQuickMenu.y + 8),
			}}
		>
			<div className="px-2 pb-2 pt-1">
				<div className="text-xs font-semibold text-(--desktop-text-primary)">
					{t('anchorQuickMenu.title')}
				</div>
				<div className="mt-0.5 text-[11px] text-(--desktop-text-muted)">
					{t('anchorQuickMenu.stats', {
						open:
							commentAnchorMeta[anchorQuickMenu.threadId]?.unresolvedComments ??
							0,
						total:
							commentAnchorMeta[anchorQuickMenu.threadId]?.totalComments ?? 0,
					})}
				</div>
			</div>
			<DesktopAppButton
				type="button"
				variant="accent"
				size="sm"
				className="w-full justify-start"
				onClick={() => onOpenThread(anchorQuickMenu.threadId)}
			>
				{t('anchorQuickMenu.openThread')}
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="neutral"
				size="sm"
				className="mt-1 w-full justify-start"
				onClick={() => onReplyThread(anchorQuickMenu.threadId)}
			>
				{t('anchorQuickMenu.replyThread')}
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="neutral"
				size="sm"
				className="mt-1 w-full justify-start"
				disabled={
					(commentAnchorMeta[anchorQuickMenu.threadId]?.unresolvedComments ??
						0) === 0
				}
				onClick={() => onResolveThread(anchorQuickMenu.threadId)}
			>
				{t('anchorQuickMenu.resolveThread')}
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="neutral"
				size="sm"
				className="mt-1 w-full justify-start"
				onClick={() => void onCopyThreadLink(anchorQuickMenu.threadId)}
			>
				{copiedThreadId === anchorQuickMenu.threadId
					? t('anchorQuickMenu.linkCopied')
					: t('anchorQuickMenu.copyLink')}
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className="mt-1 w-full justify-start"
				onClick={onDismiss}
			>
				{t('anchorQuickMenu.cancel')}
			</DesktopAppButton>
		</DesktopAppMenuSurface>
	);
};
