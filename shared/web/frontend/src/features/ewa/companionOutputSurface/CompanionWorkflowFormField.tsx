/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Styled form controls for companion workflow surfaces (DAG builder, shared chrome).
 *
 * Related:
 * - CompanionWorkflowDagBuilderMode.tsx
 */

import { useId } from 'react';

import {
	COMPANION_SURFACE_FIELD_CLASS,
	COMPANION_SURFACE_LABEL_CLASS,
} from '@/features/ewa/companionOutputSurface/companionSurfaceUi';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

type SelectOption = {
	value: string;
	label: string;
};

type BaseProps = {
	label: string;
	className?: string;
};

type TextProps = BaseProps & {
	kind: 'text';
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	maxLength?: number;
};

type TextareaProps = BaseProps & {
	kind: 'textarea';
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	maxLength?: number;
	rows?: number;
};

type SelectProps = BaseProps & {
	kind: 'select';
	value: string;
	onChange: (value: string) => void;
	options: SelectOption[];
};

export type CompanionWorkflowFormFieldProps =
	| TextProps
	| TextareaProps
	| SelectProps;

export function CompanionWorkflowFormField(
	props: CompanionWorkflowFormFieldProps
) {
	const fieldId = useId();
	const fieldClass = cn(
		COMPANION_SURFACE_FIELD_CLASS,
		DESKTOP_CHROME_FOCUS_VISIBLE
	);

	return (
		<div className={cn('flex flex-col gap-1', props.className)}>
			<label className={COMPANION_SURFACE_LABEL_CLASS} htmlFor={fieldId}>
				{props.label}
			</label>
			{props.kind === 'textarea' ? (
				<textarea
					id={fieldId}
					value={props.value}
					rows={props.rows ?? 2}
					maxLength={props.maxLength ?? 2000}
					placeholder={props.placeholder}
					onChange={(e) => props.onChange(e.target.value)}
					className={cn(fieldClass, 'resize-y min-h-[2.5rem]')}
				/>
			) : props.kind === 'select' ? (
				<select
					id={fieldId}
					value={props.value}
					onChange={(e) => props.onChange(e.target.value)}
					className={fieldClass}
				>
					{props.options.map((opt) => (
						<option key={opt.value || '__default'} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			) : (
				<input
					id={fieldId}
					type="text"
					value={props.value}
					maxLength={props.maxLength ?? 500}
					placeholder={props.placeholder}
					onChange={(e) => props.onChange(e.target.value)}
					className={fieldClass}
				/>
			)}
		</div>
	);
}
