/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Text alignment tool cluster for Ultimate Doc Editor toolbar.
 *
 * Invariants:
 * - Alignment commands use TipTap setTextAlign extension.
 *
 * Related:
 * - EditorToolbar.tsx, toolbar.groups.align i18n key
 */
import type { Editor } from '@tiptap/react';
import type { TFunction } from 'i18next';
import { Bars3BottomLeftIcon } from '@heroicons/react/24/outline';
import { EditorToolbarIconButton } from './EditorToolbarIconButton';
import { EditorToolbarToolGroup } from './EditorToolbarToolGroup';

export interface EditorToolbarAlignGroupProps {
	editor: Editor;
	t: TFunction;
}

export function EditorToolbarAlignGroup({
	editor,
	t,
}: EditorToolbarAlignGroupProps) {
	return (
		<EditorToolbarToolGroup ariaLabel={t('toolbar.groups.align')}>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.alignLeft')}
				onCommand={() => editor.chain().focus().setTextAlign('left').run()}
				isActive={editor.isActive({ textAlign: 'left' })}
				icon={<Bars3BottomLeftIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.alignCenter')}
				onCommand={() => editor.chain().focus().setTextAlign('center').run()}
				isActive={editor.isActive({ textAlign: 'center' })}
				icon={<Bars3BottomLeftIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.alignRight')}
				onCommand={() => editor.chain().focus().setTextAlign('right').run()}
				isActive={editor.isActive({ textAlign: 'right' })}
				icon={<Bars3BottomLeftIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.alignJustify')}
				onCommand={() => editor.chain().focus().setTextAlign('justify').run()}
				isActive={editor.isActive({ textAlign: 'justify' })}
				icon={<Bars3BottomLeftIcon width={16} height={16} aria-hidden />}
			/>
		</EditorToolbarToolGroup>
	);
}
