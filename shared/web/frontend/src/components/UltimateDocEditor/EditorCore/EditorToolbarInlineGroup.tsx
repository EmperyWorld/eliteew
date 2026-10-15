/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline formatting tool cluster for Ultimate Doc Editor toolbar including
 * font-family popover wiring.
 *
 * Invariants:
 * - Font family popover uses shared useEditorToolbarPopovers refs/state.
 *
 * Related:
 * - EditorToolbar.tsx, EditorToolbarFontFamilyPopoverBody.tsx
 */
import type { Editor } from '@tiptap/react';
import type { TFunction } from 'i18next';
import {
	Bars3BottomLeftIcon,
	BoldIcon,
	CodeBracketIcon,
	ItalicIcon,
	LanguageIcon,
	StrikethroughIcon,
	UnderlineIcon,
} from '@heroicons/react/24/outline';
import { normalizeFontFamily } from '../utils/editorFontPresets';
import { EditorToolbarFontFamilyPopoverBody } from './EditorToolbarFontFamilyPopoverBody';
import { EditorToolbarIconButton } from './EditorToolbarIconButton';
import { EditorToolbarPopoverFrame } from './EditorToolbarPopoverFrame';
import { EditorToolbarToolGroup } from './EditorToolbarToolGroup';
import type { UseEditorToolbarPopoversResult } from './useEditorToolbarPopovers';

export interface EditorToolbarInlineGroupProps {
	editor: Editor;
	t: TFunction;
	popovers: UseEditorToolbarPopoversResult;
}

export function EditorToolbarInlineGroup({
	editor,
	t,
	popovers,
}: EditorToolbarInlineGroupProps) {
	return (
		<EditorToolbarToolGroup ariaLabel={t('toolbar.groups.inline')}>
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
				tooltip={t('toolbar.tools.strike')}
				onCommand={() => editor.chain().focus().toggleStrike().run()}
				isActive={editor.isActive('strike')}
				icon={<StrikethroughIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.code')}
				onCommand={() => editor.chain().focus().toggleCode().run()}
				isActive={editor.isActive('code')}
				icon={<CodeBracketIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.underline')}
				onCommand={() => editor.chain().focus().toggleUnderline().run()}
				isActive={editor.isActive('underline')}
				icon={<UnderlineIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.subscript')}
				onCommand={() => editor.chain().focus().toggleSubscript().run()}
				isActive={editor.isActive('subscript')}
				icon={<Bars3BottomLeftIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.superscript')}
				onCommand={() => editor.chain().focus().toggleSuperscript().run()}
				isActive={editor.isActive('superscript')}
				icon={<Bars3BottomLeftIcon width={16} height={16} aria-hidden />}
			/>

			<div className="relative">
				<EditorToolbarIconButton
					ref={popovers.fontFamilyButtonRef}
					tooltip={t('toolbar.tools.fontFamily')}
					onCommand={() => popovers.togglePopover('fontFamily')}
					isActive={
						popovers.activePopover === 'fontFamily' ||
						normalizeFontFamily(
							editor.getAttributes('textStyle').fontFamily
						) !== ''
					}
					icon={<LanguageIcon width={16} height={16} aria-hidden />}
				/>
				<EditorToolbarPopoverFrame
					id="fontFamily"
					popoverRef={popovers.fontFamilyPopoverRef}
					header={{
						icon: <LanguageIcon width={22} height={22} />,
						title: t('toolbar.popovers.font.title'),
						subtitle: t('toolbar.popovers.font.subtitle'),
					}}
					activePopover={popovers.activePopover}
					popoverPosition={popovers.popoverPosition}
					closePopover={popovers.closePopover}
					closePanelAriaLabel={t('toolbar.aria.closePanel')}
				>
					<EditorToolbarFontFamilyPopoverBody
						editor={editor}
						onSelectPreset={popovers.handleFontFamilySelect}
						fontPresetLabel={(presetId) =>
							t(`slashCommands.fontPresetLabels.${presetId}`)
						}
					/>
				</EditorToolbarPopoverFrame>
			</div>
		</EditorToolbarToolGroup>
	);
}
