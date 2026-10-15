/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * List and blockquote tool cluster for Ultimate Doc Editor toolbar.
 *
 * Invariants:
 * - Task list toggle requires TipTap taskList extension in editor schema.
 *
 * Related:
 * - EditorToolbar.tsx, toolbar.groups.lists i18n key
 */
import type { Editor } from '@tiptap/react';
import type { TFunction } from 'i18next';
import {
	ChatBubbleBottomCenterTextIcon,
	ClipboardDocumentCheckIcon,
	ListBulletIcon,
	NumberedListIcon,
} from '@heroicons/react/24/outline';
import { EditorToolbarIconButton } from './EditorToolbarIconButton';
import { EditorToolbarToolGroup } from './EditorToolbarToolGroup';

export interface EditorToolbarListsGroupProps {
	editor: Editor;
	t: TFunction;
}

export function EditorToolbarListsGroup({
	editor,
	t,
}: EditorToolbarListsGroupProps) {
	return (
		<EditorToolbarToolGroup ariaLabel={t('toolbar.groups.lists')}>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.bulletList')}
				onCommand={() => editor.chain().focus().toggleBulletList().run()}
				isActive={editor.isActive('bulletList')}
				icon={<ListBulletIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.orderedList')}
				onCommand={() => editor.chain().focus().toggleOrderedList().run()}
				isActive={editor.isActive('orderedList')}
				icon={<NumberedListIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.taskList')}
				onCommand={() => editor.chain().focus().toggleTaskList().run()}
				isActive={editor.isActive('taskList')}
				icon={<ClipboardDocumentCheckIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.blockquote')}
				onCommand={() => editor.chain().focus().toggleBlockquote().run()}
				isActive={editor.isActive('blockquote')}
				icon={
					<ChatBubbleBottomCenterTextIcon width={16} height={16} aria-hidden />
				}
			/>
		</EditorToolbarToolGroup>
	);
}
