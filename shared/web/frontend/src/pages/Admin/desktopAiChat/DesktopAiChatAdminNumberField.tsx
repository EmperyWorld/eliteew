/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared number input for Desktop AI Chat admin forms (Defaults, Memory cells).
 *
 * Invariants:
 * - Clamping happens in read/merge helpers; this control only commits finite numbers.
 *
 * Related:
 * - DesktopAiChatDefaultsTab.tsx
 * - DesktopAiChatMemoryCellsTab.tsx
 */

import * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';

export function DesktopAiChatAdminNumberField({
	id,
	label,
	hint,
	value,
	min,
	max,
	step,
	disabled,
	onChange,
}: {
	id: string;
	label: string;
	hint?: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	disabled?: boolean;
	onChange: (next: number) => void;
}): React.ReactElement {
	return (
		<label htmlFor={id} className="block space-y-1">
			<span className="font-medium text-white/95">{label}</span>
			{hint ? (
				<span className={`${DESKTOP_TYPOGRAPHY.caption} block text-white/55`}>
					{hint}
				</span>
			) : null}
			<input
				id={id}
				type="number"
				min={min}
				max={max}
				step={step ?? 1}
				disabled={disabled}
				value={value}
				onChange={(e) => {
					const n = Number(e.target.value);
					if (Number.isFinite(n)) onChange(n);
				}}
				className="mt-1 w-full max-w-xs rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
			/>
		</label>
	);
}
