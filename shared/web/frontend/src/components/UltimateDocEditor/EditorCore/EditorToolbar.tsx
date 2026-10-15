/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Formatting toolbar for Ultimate Doc Editor TipTap — composes tool groups,
 * overflow layout, and popover hook; groups live in EditorToolbar*Group modules.
 *
 * Invariants:
 * - Named export EditorToolbar on this path (MainGrid lazy import depends on it).
 * - useEditorToolbarCompose runs before isUsableTiptapEditor guard.
 *
 * Related:
 * - TiptapEditorInner.tsx, useEditorToolbarCompose.ts, EditorToolbarOverflowLayout.tsx
 */
import type { Editor } from '@tiptap/react';
import type * as React from 'react';
import { cn } from '@/utils/cn';
import { canSplitSelectionIntoLines } from '../utils/splitSelectionIntoLines';
import {
	isUsableTiptapEditor,
	safeEditorCanRedo,
	safeEditorCanUndo,
} from '../utils/isUsableTiptapEditor';
import { DOC_EDITOR_TOOLBAR_SHELL_CLASS } from './docEditorToolbarChrome';
import { EditorToolbarAccentGroup } from './EditorToolbarAccentGroup';
import { EditorToolbarAlignGroup } from './EditorToolbarAlignGroup';
import { EditorToolbarHistoryGroup } from './EditorToolbarHistoryGroup';
import { EditorToolbarInlineGroup } from './EditorToolbarInlineGroup';
import { EditorToolbarInsertGroup } from './EditorToolbarInsertGroup';
import { EditorToolbarListsGroup } from './EditorToolbarListsGroup';
import { EditorToolbarOverflowLayout } from './EditorToolbarOverflowLayout';
import { EditorToolbarStructureGroup } from './EditorToolbarStructureGroup';
import { useEditorToolbarCompose } from './useEditorToolbarCompose';

interface EditorToolbarProps {
	editor: Editor | null;
	className?: string;
	closeSignal?: number;
	onRequestExclusiveOpen?: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
	editor,
	className,
	closeSignal,
	onRequestExclusiveOpen,
}) => {
	const { reduceMotion, t, popovers } = useEditorToolbarCompose({
		editor,
		closeSignal,
		onRequestExclusiveOpen,
	});

	if (!isUsableTiptapEditor(editor)) {
		return null;
	}

	const canUndo = safeEditorCanUndo(editor);
	const canRedo = safeEditorCanRedo(editor);
	const canSplitLines = canSplitSelectionIntoLines(editor);

	const historyGroup = (
		<EditorToolbarHistoryGroup
			editor={editor}
			t={t}
			canUndo={canUndo}
			canRedo={canRedo}
			canSplitLines={canSplitLines}
		/>
	);

	const toolbarGroups = (
		<>
			{historyGroup}
			<EditorToolbarInlineGroup editor={editor} t={t} popovers={popovers} />
			<EditorToolbarStructureGroup editor={editor} t={t} />
			<EditorToolbarListsGroup editor={editor} t={t} />
			<EditorToolbarAlignGroup editor={editor} t={t} />
			<EditorToolbarInsertGroup editor={editor} t={t} popovers={popovers} />
			<EditorToolbarAccentGroup editor={editor} t={t} popovers={popovers} />
		</>
	);

	return (
		<div className={cn(DOC_EDITOR_TOOLBAR_SHELL_CLASS, className)}>
			<div className="relative min-w-0">
				<EditorToolbarOverflowLayout
					editor={editor}
					t={t}
					popovers={popovers}
					reduceMotion={reduceMotion}
					onRequestExclusiveOpen={onRequestExclusiveOpen}
					historyGroup={historyGroup}
					toolbarGroups={toolbarGroups}
				/>
			</div>
		</div>
	);
};
