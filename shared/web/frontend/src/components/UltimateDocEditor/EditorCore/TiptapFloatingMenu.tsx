/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TipTap floating menu for Ultimate Doc Editor — block formatting on empty lines.
 *
 * Invariants:
 * - shouldShow mirrors pre-atomization root-depth empty textblock guards.
 * - Uses fixed floating-ui strategy for desktop shell transform scale.
 *
 * Related:
 * - TiptapEditor.tsx
 */
import {
	getText,
	getTextSerializersFromSchema,
	type Editor,
} from '@tiptap/core';
import { NumberedListIcon } from '@heroicons/react/24/outline';
import { type EditorState } from '@tiptap/pm/state';
import { type EditorView } from '@tiptap/pm/view';
import { FloatingMenu } from '@tiptap/react/menus';
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '../../../i18n/config';
import {
	DesktopAppButton,
	DesktopAppMenuSurface,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import type { TiptapFloatingUiOptions } from './tiptapFloatingUiOptions';

export function floatingMenuShouldShow({
	editor: ed,
	view,
	state,
}: {
	editor: Editor;
	view: EditorView;
	state: EditorState;
	oldState?: EditorState;
	from: number;
	to: number;
}): boolean {
	if (!ed || (ed as { isDestroyed?: boolean }).isDestroyed) {
		return false;
	}
	const docViewFloating = (view as { docView?: unknown }).docView;
	if (!docViewFloating) {
		return false;
	}
	const { selection } = state;
	const { $anchor, empty } = selection;
	const isRootDepth = $anchor.depth === 1;
	const textSerializers = getTextSerializersFromSchema(ed.schema);
	const parentText = getText($anchor.parent, { textSerializers });
	const isEmptyTextBlock =
		$anchor.parent.isTextblock &&
		!$anchor.parent.type.spec.code &&
		!$anchor.parent.textContent &&
		$anchor.parent.childCount === 0 &&
		!parentText;
	if (
		!view.hasFocus() ||
		!empty ||
		!isRootDepth ||
		!isEmptyTextBlock ||
		!ed.isEditable
	) {
		return false;
	}
	return true;
}

export interface TiptapFloatingMenuProps {
	editor: Editor;
	floatingChromePaused: boolean;
	floatingUiOptions: TiptapFloatingUiOptions;
}

export function TiptapFloatingMenu({
	editor,
	floatingChromePaused,
	floatingUiOptions,
}: TiptapFloatingMenuProps): React.ReactElement | null {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);

	if (!editor || floatingChromePaused) {
		return null;
	}

	return (
		<FloatingMenu
			editor={editor}
			shouldShow={floatingMenuShouldShow}
			resizeDelay={120}
			options={floatingUiOptions}
			className="bg-transparent! border-none! p-0! shadow-none!"
		>
			<DesktopAppMenuSurface className="flex max-w-[min(100vw-2rem,520px)] flex-wrap items-center gap-1 p-2">
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 1 }).run()
					}
				>
					H1
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 2 }).run()
					}
				>
					H2
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 3 }).run()
					}
				>
					H3
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 4 }).run()
					}
				>
					H4
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 5 }).run()
					}
				>
					H5
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 6 }).run()
					}
				>
					H6
				</DesktopAppButton>
				<div className="mx-1 h-6 w-px shrink-0 bg-(--desktop-border-subtle)" />
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => editor.chain().focus().toggleBulletList().run()}
				>
					{t('floatingMenu.bulletList')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className="gap-1.5"
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
					title={t('floatingMenu.orderedListTitle')}
				>
					<NumberedListIcon width={16} height={16} className="opacity-80" />
					<span className="hidden sm:inline">
						{t('floatingMenu.orderedListLabel')}
					</span>
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => editor.chain().focus().toggleTaskList().run()}
				>
					{t('floatingMenu.taskList')}
				</DesktopAppButton>
			</DesktopAppMenuSurface>
		</FloatingMenu>
	);
}
