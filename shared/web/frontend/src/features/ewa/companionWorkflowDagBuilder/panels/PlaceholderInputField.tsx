/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Text input with optional variable-picker trigger for DAG placeholder fields.
 *
 * Related:
 * - DagVariablePicker.tsx
 */

import { CodeBracketIcon } from '@heroicons/react/24/outline';
import { useCallback, useId, useRef } from 'react';

import type { PickerAnchor } from '@/features/ewa/companionWorkflowDagBuilder/state/dagBuilderSelection';
import { useDagBuilderEditor } from '@/features/ewa/companionWorkflowDagBuilder/state/DagBuilderEditorContext';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

type Props = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	pickerAnchor: PickerAnchor;
	multiline?: boolean;
	disabled?: boolean;
};

function insertAtCursor(
	element: HTMLTextAreaElement | HTMLInputElement,
	current: string,
	insertion: string
): string {
	const start = element.selectionStart ?? current.length;
	const end = element.selectionEnd ?? current.length;
	return `${current.slice(0, start)}${insertion}${current.slice(end)}`;
}

export function PlaceholderInputField({
	label,
	value,
	onChange,
	pickerAnchor,
	multiline = false,
	disabled = false,
}: Props) {
	const fieldId = useId();
	const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
	const { openPicker } = useDagBuilderEditor();

	const handleOpenPicker = useCallback(() => {
		openPicker(pickerAnchor, inputRef.current);
	}, [openPicker, pickerAnchor]);

	const sharedClass = cn(
		'w-full rounded-lg border border-(--companion-border-subtle)',
		'bg-(--companion-surface-soft)/40 px-2.5 py-1.5 text-sm text-(--companion-text-primary)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between gap-2">
				<label
					htmlFor={fieldId}
					className="text-xs font-medium text-(--companion-text-soft)"
				>
					{label}
				</label>
				<button
					type="button"
					className={cn(
						'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]',
						'text-(--companion-aura) hover:bg-(--companion-aura)/10',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					disabled={disabled}
					onClick={handleOpenPicker}
				>
					<CodeBracketIcon className="h-3.5 w-3.5" aria-hidden />
					<span>Insert</span>
				</button>
			</div>
			{multiline ? (
				<textarea
					ref={inputRef as React.RefObject<HTMLTextAreaElement>}
					id={fieldId}
					className={cn(sharedClass, 'min-h-[72px] resize-y font-mono text-xs')}
					value={value}
					disabled={disabled}
					onChange={(event) => onChange(event.target.value)}
				/>
			) : (
				<input
					ref={inputRef as React.RefObject<HTMLInputElement>}
					id={fieldId}
					className={cn(sharedClass, 'font-mono text-xs')}
					value={value}
					disabled={disabled}
					onChange={(event) => onChange(event.target.value)}
				/>
			)}
		</div>
	);
}

export { insertAtCursor };
