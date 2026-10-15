/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Accent and advanced insert cluster (code block, HR, formula, color/highlight)
 * for Ultimate Doc Editor toolbar.
 *
 * Invariants:
 * - Formula dialog dispatches runtime event; color pickers use popover positions.
 *
 * Related:
 * - EditorToolbar.tsx, ColorPicker.tsx, runtimeDialogEvents.ts
 */
import type { Editor } from '@tiptap/react';
import type { TFunction } from 'i18next';
import {
	CodeBracketIcon,
	CodeBracketSquareIcon,
	MinusIcon,
	SparklesIcon,
	SwatchIcon,
} from '@heroicons/react/24/outline';
import { ColorPicker } from '../components/ColorPicker';
import { dispatchDocEditorRuntimeDialogRequest } from '../utils/runtimeDialogEvents';
import { EditorToolbarIconButton } from './EditorToolbarIconButton';
import { EditorToolbarToolGroup } from './EditorToolbarToolGroup';
import type { UseEditorToolbarPopoversResult } from './useEditorToolbarPopovers';

export interface EditorToolbarAccentGroupProps {
	editor: Editor;
	t: TFunction;
	popovers: UseEditorToolbarPopoversResult;
}

export function EditorToolbarAccentGroup({
	editor,
	t,
	popovers,
}: EditorToolbarAccentGroupProps) {
	return (
		<EditorToolbarToolGroup ariaLabel={t('toolbar.groups.accent')}>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.codeBlock')}
				onCommand={() => editor.chain().focus().toggleCodeBlock().run()}
				isActive={editor.isActive('codeBlock')}
				icon={<CodeBracketIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.horizontalRule')}
				onCommand={() => editor.chain().focus().setHorizontalRule().run()}
				icon={<MinusIcon width={16} height={16} aria-hidden />}
			/>
			<EditorToolbarIconButton
				tooltip={t('toolbar.tools.formula')}
				onCommand={() => {
					const selection = editor.state.selection.empty
						? undefined
						: {
								from: editor.state.selection.from,
								to: editor.state.selection.to,
							};
					dispatchDocEditorRuntimeDialogRequest({
						type: 'formula',
						range: selection,
						initialValue: 'E = mc^2',
					});
				}}
				icon={<CodeBracketSquareIcon width={16} height={16} aria-hidden />}
			/>
			<div className="relative">
				<EditorToolbarIconButton
					ref={popovers.colorButtonRef}
					tooltip={t('toolbar.tools.textColor')}
					onCommand={() => popovers.togglePopover('color')}
					isActive={
						popovers.activePopover === 'color' ||
						editor.isActive('textStyle', { color: /.*/ })
					}
					icon={<SwatchIcon width={16} height={16} aria-hidden />}
				/>
				{popovers.activePopover === 'color' && popovers.colorPickerPosition ? (
					<ColorPicker
						type="text"
						currentColor={editor.getAttributes('textStyle').color || '#000000'}
						onColorChange={(color) => {
							editor.chain().focus().setColor(color).run();
							popovers.closePopover();
						}}
						onClose={popovers.closePopover}
						position={popovers.colorPickerPosition}
					/>
				) : null}
			</div>
			<div className="relative">
				<EditorToolbarIconButton
					ref={popovers.highlightButtonRef}
					tooltip={t('toolbar.tools.highlight')}
					onCommand={() => popovers.togglePopover('highlight')}
					isActive={
						popovers.activePopover === 'highlight' ||
						editor.isActive('highlight')
					}
					icon={<SparklesIcon width={16} height={16} aria-hidden />}
				/>
				{popovers.activePopover === 'highlight' &&
				popovers.colorPickerPosition ? (
					<ColorPicker
						type="highlight"
						currentColor={editor.getAttributes('highlight').color || '#FFFF00'}
						onColorChange={(color) => {
							editor.chain().focus().toggleHighlight({ color }).run();
							popovers.closePopover();
						}}
						onClose={popovers.closePopover}
						position={popovers.colorPickerPosition}
					/>
				) : null}
			</div>
		</EditorToolbarToolGroup>
	);
}
