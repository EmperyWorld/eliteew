/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wide vs narrow (≤900px) toolbar layout for Ultimate Doc Editor — reuses
 * HistoryGroup in strip and overflow panel; overflow panel id is stable.
 *
 * Invariants:
 * - Overflow panel element id is always editor-toolbar-overflow-panel.
 * - HistoryGroup is passed in for deduplication between strip and full groups.
 *
 * Related:
 * - EditorToolbar.tsx, useEditorToolbarPopovers.ts
 */
import type { Editor } from '@tiptap/react';
import { AnimatePresence, motion } from 'framer-motion';
import type * as React from 'react';
import type { TFunction } from 'i18next';
import {
	BoldIcon,
	EllipsisHorizontalIcon,
	ItalicIcon,
	UnderlineIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';
import { DesktopAppButton } from '../../../pages/Desktop/components/DesktopAppChrome';
import { ShellPortalMount } from '../../../pages/Desktop/shell/shellPortal';
import { EditorToolbarIconButton } from './EditorToolbarIconButton';
import type { UseEditorToolbarPopoversResult } from './useEditorToolbarPopovers';

export interface EditorToolbarOverflowLayoutProps {
	editor: Editor;
	t: TFunction;
	popovers: UseEditorToolbarPopoversResult;
	reduceMotion: boolean | null;
	onRequestExclusiveOpen?: () => void;
	historyGroup: React.ReactNode;
	toolbarGroups: React.ReactNode;
}

export function EditorToolbarOverflowLayout({
	editor,
	t,
	popovers,
	reduceMotion,
	onRequestExclusiveOpen,
	historyGroup,
	toolbarGroups,
}: EditorToolbarOverflowLayoutProps) {
	if (popovers.toolbarNarrow) {
		return (
			<>
				<div
					className="flex flex-nowrap items-center gap-x-2 gap-y-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]"
					role="toolbar"
					aria-label={t('toolbar.aria.bar')}
				>
					{historyGroup}
					<EditorToolbarIconButton
						tooltip={t('toolbar.tools.bold')}
						onCommand={() => editor.chain().focus().toggleBold().run()}
						isActive={editor.isActive('bold')}
						icon={<BoldIcon width={16} height={16} aria-hidden />}
					/>
					<EditorToolbarIconButton
						tooltip={t('toolbar.tools.italic')}
						onCommand={() => editor.chain().focus().toggleItalic().run()}
						isActive={editor.isActive('italic')}
						icon={<ItalicIcon width={16} height={16} aria-hidden />}
					/>
					<EditorToolbarIconButton
						tooltip={t('toolbar.tools.underline')}
						onCommand={() => editor.chain().focus().toggleUnderline().run()}
						isActive={editor.isActive('underline')}
						icon={<UnderlineIcon width={16} height={16} aria-hidden />}
					/>
					<EditorToolbarIconButton
						ref={popovers.overflowButtonRef}
						tooltip={t('toolbar.overflow')}
						onCommand={() => {
							onRequestExclusiveOpen?.();
							popovers.setOverflowMenuOpen((open) => !open);
						}}
						isActive={popovers.overflowMenuOpen}
						icon={<EllipsisHorizontalIcon width={16} height={16} aria-hidden />}
					/>
				</div>
				{popovers.overflowMenuOpen && popovers.overflowPosition ? (
					<ShellPortalMount>
						<AnimatePresence>
							<motion.div
								id="editor-toolbar-overflow-panel"
								key="toolbar-overflow"
								role="dialog"
								aria-label={t('toolbar.overflow')}
								initial={
									reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }
								}
								animate={{ opacity: 1, y: 0 }}
								exit={
									reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }
								}
								transition={{
									duration: reduceMotion ? 0 : 0.16,
									ease: 'easeOut',
								}}
								className="fixed max-h-[min(70vh,560px)] w-[min(calc(100vw-16px),420px)] overflow-y-auto overscroll-y-contain rounded-2xl border border-(--desktop-border-strong) bg-(--desktop-surface-panel-strong) p-3 shadow-(--desktop-shadow-panel) backdrop-blur-xl"
								style={{
									zIndex: popovers.embeddedModalZ.content,
									left: popovers.overflowPosition.x,
									top: popovers.overflowPosition.y,
								}}
							>
								<div className="mb-2 flex items-center justify-between gap-2 border-b border-(--desktop-border-subtle) pb-2">
									<span className="text-xs font-semibold text-(--desktop-text-primary)">
										{t('toolbar.overflow')}
									</span>
									<DesktopAppButton
										type="button"
										size="icon"
										variant="ghost"
										className="h-8 w-8 shrink-0"
										aria-label={t('toolbar.aria.close')}
										onClick={() => popovers.setOverflowMenuOpen(false)}
									>
										<XCircleIcon width={18} height={18} />
									</DesktopAppButton>
								</div>
								<div className="flex flex-col gap-2">{toolbarGroups}</div>
							</motion.div>
						</AnimatePresence>
					</ShellPortalMount>
				) : null}
			</>
		);
	}

	return (
		<div
			className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
			role="toolbar"
			aria-label={t('toolbar.aria.bar')}
		>
			{toolbarGroups}
		</div>
	);
}
