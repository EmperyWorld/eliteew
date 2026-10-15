/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TipTap bubble menu for Ultimate Doc Editor — inline formatting on text selection.
 *
 * Invariants:
 * - shouldShow mirrors pre-atomization focus/empty/editable guards.
 * - Uses fixed floating-ui strategy for desktop shell transform scale.
 *
 * Related:
 * - TiptapEditor.tsx
 */
import { isTextSelection, type Editor } from '@tiptap/core';
import {
	BoldIcon,
	ItalicIcon,
	LinkIcon,
	SparklesIcon,
	SwatchIcon,
	UnderlineIcon,
} from '@heroicons/react/24/outline';
import { type EditorState } from '@tiptap/pm/state';
import { type EditorView } from '@tiptap/pm/view';
import { BubbleMenu } from '@tiptap/react/menus';
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '../../../i18n/config';
import {
	DesktopAppButton,
	DesktopAppMenuSurface,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import type { TiptapFloatingUiOptions } from './tiptapFloatingUiOptions';

export function bubbleMenuShouldShow({
	editor: ed,
	element,
	view,
	state,
	from,
	to,
}: {
	editor: Editor;
	element: HTMLElement;
	view: EditorView;
	state: EditorState;
	from: number;
	to: number;
}): boolean {
	if (!ed || (ed as { isDestroyed?: boolean }).isDestroyed) {
		return false;
	}
	const docView = (view as { docView?: unknown }).docView;
	if (!docView) {
		return false;
	}
	const { doc, selection } = state;
	const { empty } = selection;
	const isEmptyTextBlock =
		!doc.textBetween(from, to).length && isTextSelection(state.selection);
	const isChildOfMenu = element.contains(document.activeElement);
	const hasEditorFocus = view.hasFocus() || isChildOfMenu;
	if (!hasEditorFocus || empty || isEmptyTextBlock || !ed.isEditable) {
		return false;
	}
	return true;
}

export interface TiptapBubbleMenuProps {
	editor: Editor;
	floatingChromePaused: boolean;
	floatingUiOptions: TiptapFloatingUiOptions;
	onOpenTextColor: (event: React.MouseEvent<HTMLButtonElement>) => void;
	onOpenHighlightColor: (event: React.MouseEvent<HTMLButtonElement>) => void;
	onOpenLink: () => void;
}

export function TiptapBubbleMenu({
	editor,
	floatingChromePaused,
	floatingUiOptions,
	onOpenTextColor,
	onOpenHighlightColor,
	onOpenLink,
}: TiptapBubbleMenuProps): React.ReactElement | null {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);

	if (!editor || floatingChromePaused) {
		return null;
	}

	return (
		<BubbleMenu
			editor={editor}
			shouldShow={bubbleMenuShouldShow}
			resizeDelay={120}
			options={floatingUiOptions}
			className="bg-transparent! border-none! p-0! shadow-none!"
		>
			<DesktopAppMenuSurface className="flex items-center gap-1 p-2">
				<DesktopAppButton
					type="button"
					variant={editor.isActive('bold') ? 'accent' : 'ghost'}
					active={editor.isActive('bold')}
					size="icon"
					onClick={() => editor.chain().focus().toggleBold().run()}
					title={t('bubbleMenu.bold')}
					aria-label={t('bubbleMenu.boldAria')}
				>
					<BoldIcon width={18} height={18} />
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant={editor.isActive('italic') ? 'accent' : 'ghost'}
					active={editor.isActive('italic')}
					size="icon"
					onClick={() => editor.chain().focus().toggleItalic().run()}
					title={t('bubbleMenu.italic')}
					aria-label={t('bubbleMenu.italicAria')}
				>
					<ItalicIcon width={18} height={18} />
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant={editor.isActive('underline') ? 'accent' : 'ghost'}
					active={editor.isActive('underline')}
					size="icon"
					onClick={() => editor.chain().focus().toggleUnderline().run()}
					title={t('bubbleMenu.underline')}
					aria-label={t('bubbleMenu.underlineAria')}
				>
					<UnderlineIcon width={18} height={18} />
				</DesktopAppButton>
				<div className="mx-1 h-6 w-px bg-(--desktop-border-subtle)" />
				<div className="relative">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						onClick={onOpenTextColor}
						title={t('bubbleMenu.textColor')}
						aria-label={t('bubbleMenu.textColorAria')}
					>
						<SwatchIcon width={18} height={18} />
					</DesktopAppButton>
				</div>
				<div className="relative">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						onClick={onOpenHighlightColor}
						title={t('bubbleMenu.highlight')}
						aria-label={t('bubbleMenu.highlightAria')}
					>
						<SparklesIcon width={18} height={18} />
					</DesktopAppButton>
				</div>
				<div className="mx-1 h-6 w-px bg-(--desktop-border-subtle)" />
				<DesktopAppButton
					type="button"
					variant={editor.isActive('link') ? 'accent' : 'ghost'}
					active={editor.isActive('link')}
					size="icon"
					onClick={onOpenLink}
					title={t('bubbleMenu.link')}
					aria-label={t('bubbleMenu.linkAria')}
				>
					<LinkIcon width={18} height={18} />
				</DesktopAppButton>
			</DesktopAppMenuSurface>
		</BubbleMenu>
	);
}
