/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Heading level tool cluster (H1–H6) for Ultimate Doc Editor toolbar.
 *
 * Invariants:
 * - Each heading toggle uses TipTap toggleHeading with explicit level.
 *
 * Related:
 * - EditorToolbar.tsx, toolbar.groups.structure i18n key
 */
import type { Editor } from '@tiptap/react';
import type { TFunction } from 'i18next';
import { Bars3BottomLeftIcon } from '@heroicons/react/24/outline';
import { DOC_EDITOR_TOOLBAR_HEADING_GLYPH_CLASS } from './docEditorToolbarChrome';
import { EditorToolbarIconButton } from './EditorToolbarIconButton';
import { EditorToolbarToolGroup } from './EditorToolbarToolGroup';

export interface EditorToolbarStructureGroupProps {
	editor: Editor;
	t: TFunction;
}

export function EditorToolbarStructureGroup({
	editor,
	t,
}: EditorToolbarStructureGroupProps) {
	return (
		<EditorToolbarToolGroup ariaLabel={t('toolbar.groups.structure')}>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.h1')}
				onCommand={() =>
					editor.chain().focus().toggleHeading({ level: 1 }).run()
				}
				isActive={editor.isActive('heading', { level: 1 })}
				icon={<Bars3BottomLeftIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.h2')}
				onCommand={() =>
					editor.chain().focus().toggleHeading({ level: 2 }).run()
				}
				isActive={editor.isActive('heading', { level: 2 })}
				icon={<Bars3BottomLeftIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.h3')}
				onCommand={() =>
					editor.chain().focus().toggleHeading({ level: 3 }).run()
				}
				isActive={editor.isActive('heading', { level: 3 })}
				icon={<Bars3BottomLeftIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.h4')}
				onCommand={() =>
					editor.chain().focus().toggleHeading({ level: 4 }).run()
				}
				isActive={editor.isActive('heading', { level: 4 })}
				icon={
					<span className={DOC_EDITOR_TOOLBAR_HEADING_GLYPH_CLASS}>H4</span>
				}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.h5')}
				onCommand={() =>
					editor.chain().focus().toggleHeading({ level: 5 }).run()
				}
				isActive={editor.isActive('heading', { level: 5 })}
				icon={
					<span className={DOC_EDITOR_TOOLBAR_HEADING_GLYPH_CLASS}>H5</span>
				}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.h6')}
				onCommand={() =>
					editor.chain().focus().toggleHeading({ level: 6 }).run()
				}
				isActive={editor.isActive('heading', { level: 6 })}
				icon={
					<span className={DOC_EDITOR_TOOLBAR_HEADING_GLYPH_CLASS}>H6</span>
				}
			/>
		</EditorToolbarToolGroup>
	);
}
