/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Toolbar profession vertical picker for Professional Worlds (active vs pending activations).
 *
 * Invariants:
 * - Caller owns activation flow; this component is presentational only.
 *
 * Related:
 * - ProfessionalWorldsRuntimeShell.tsx
 * - ProfessionalWorldsApp.tsx
 */

import { useMemo } from 'react';

import { cn } from '@/utils/cn';

import type { ProfessionalWorldsVerticalToolbarOption } from '../ProfessionalWorldsRuntimeShell';
import { PROFESSIONAL_WORLDS_FIELD_CLASS } from '../utils/professionalWorldsFormUtils';

export type VerticalSwitcherPopoverProps = {
	options: ProfessionalWorldsVerticalToolbarOption[];
	value: string;
	disabled?: boolean;
	ariaLabel: string;
	optgroupLabels?: { active: string; connect: string };
	onChange: (slug: string) => void;
	className?: string;
};

export function VerticalSwitcherPopover({
	options,
	value,
	disabled,
	ariaLabel,
	optgroupLabels,
	onChange,
	className,
}: VerticalSwitcherPopoverProps) {
	const children = useMemo(() => {
		if (options.length === 0) {
			return null;
		}
		const row = (option: ProfessionalWorldsVerticalToolbarOption) => (
			<option key={option.slug} value={option.slug}>
				{option.label}
				{option.needsActivation ? ' · +' : ''}
			</option>
		);
		const pending = (option: ProfessionalWorldsVerticalToolbarOption) =>
			option.needsActivation;
		const activeRows = options.filter((option) => !pending(option));
		const pendingRows = options.filter((option) => pending(option));
		const lg = optgroupLabels;
		if (lg && activeRows.length > 0 && pendingRows.length > 0) {
			return (
				<>
					<optgroup label={lg.active}>{activeRows.map(row)}</optgroup>
					<optgroup label={lg.connect}>{pendingRows.map(row)}</optgroup>
				</>
			);
		}
		return options.map(row);
	}, [optgroupLabels, options]);

	if (options.length === 0) {
		return null;
	}

	return (
		<div data-pw-guide="vertical" className={cn('min-w-0', className)}>
			<select
				disabled={disabled === true}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				aria-label={ariaLabel}
				className={cn(PROFESSIONAL_WORLDS_FIELD_CLASS, 'max-w-full truncate')}
			>
				{children}
			</select>
		</div>
	);
}
