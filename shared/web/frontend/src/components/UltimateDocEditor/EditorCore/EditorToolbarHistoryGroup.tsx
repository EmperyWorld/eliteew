/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * History and selection cleanup tool cluster for Ultimate Doc Editor toolbar
 * (undo, redo, remove empty lines, split selection into lines).
 *
 * Invariants:
 * - Disabled reasons mirror parent canUndo/canRedo/canSplitLines gates.
 *
 * Related:
 * - EditorToolbar.tsx, toolbar.groups.history i18n key
 */
import type { Editor } from '@tiptap/react';
import type { TFunction } from 'i18next';
import {
	ArrowUturnLeftIcon,
	ArrowUturnRightIcon,
	BackspaceIcon,
	Bars3BottomLeftIcon,
} from '@heroicons/react/24/outline';
import { removeEmptyBlockLines } from '../utils/removeEmptyLines';
import { splitSelectionIntoLines } from '../utils/splitSelectionIntoLines';
import { EditorToolbarIconButton } from './EditorToolbarIconButton';
import { EditorToolbarToolGroup } from './EditorToolbarToolGroup';

export interface EditorToolbarHistoryGroupProps {
	editor: Editor;
	t: TFunction;
	canUndo: boolean;
	canRedo: boolean;
	canSplitLines: boolean;
}

export function EditorToolbarHistoryGroup({
	editor,
	t,
	canUndo,
	canRedo,
	canSplitLines,
}: EditorToolbarHistoryGroupProps) {
	return (
		<EditorToolbarToolGroup ariaLabel={t('toolbar.groups.history')}>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.undo')}
				disabledReason={!canUndo ? t('toolbar.undoDisabled') : undefined}
				onCommand={() => editor.chain().focus().undo().run()}
				disabled={!canUndo}
				icon={<ArrowUturnLeftIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.redo')}
				disabledReason={!canRedo ? t('toolbar.redoDisabled') : undefined}
				onCommand={() => editor.chain().focus().redo().run()}
				disabled={!canRedo}
				icon={<ArrowUturnRightIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.removeEmptyLines')}
				onCommand={() => {
					removeEmptyBlockLines(editor);
				}}
				icon={<BackspaceIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.splitSelectionLines')}
				disabledReason={
					!canSplitLines ? t('toolbar.splitSelectionLinesDisabled') : undefined
				}
				disabled={!canSplitLines}
				onCommand={() => {
					splitSelectionIntoLines(editor);
				}}
				icon={<Bars3BottomLeftIcon width={16} height={16} aria-hidden />}
			/>
		</EditorToolbarToolGroup>
	);
}
