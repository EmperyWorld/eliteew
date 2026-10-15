/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Font family picker popover body for Ultimate Doc Editor toolbar.
 *
 * Invariants:
 * - Preset selection runs editor chain via parent callback then closes popover.
 *
 * Related:
 * - EditorToolbar.tsx, editorFontPresets.ts
 */
import type { Editor } from '@tiptap/react';
import { DesktopAppButton } from '../../../pages/Desktop/components/DesktopAppChrome';
import {
	EDITOR_FONT_PRESETS,
	normalizeFontFamily,
} from '../utils/editorFontPresets';

export interface EditorToolbarFontFamilyPopoverBodyProps {
	editor: Editor;
	onSelectPreset: (fontFamily: string) => void;
	fontPresetLabel: (presetId: string) => string;
}

export function EditorToolbarFontFamilyPopoverBody({
	editor,
	onSelectPreset,
	fontPresetLabel,
}: EditorToolbarFontFamilyPopoverBodyProps) {
	const current = normalizeFontFamily(
		editor.getAttributes('textStyle').fontFamily
	);

	return (
		<div className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
			{EDITOR_FONT_PRESETS.map((preset) => {
				const selected =
					preset.fontFamily === ''
						? current === ''
						: current === preset.fontFamily;
				return (
					<DesktopAppButton
						key={preset.presetId}
						type="button"
						variant={selected ? 'accent' : 'ghost'}
						size="sm"
						className="w-full justify-start text-left"
						onMouseDown={(event) => {
							event.preventDefault();
						}}
						onClick={() => onSelectPreset(preset.fontFamily)}
					>
						<span
							className="truncate"
							style={
								preset.fontFamily
									? { fontFamily: preset.fontFamily }
									: undefined
							}
						>
							{fontPresetLabel(preset.presetId)}
						</span>
					</DesktopAppButton>
				);
			})}
		</div>
	);
}
