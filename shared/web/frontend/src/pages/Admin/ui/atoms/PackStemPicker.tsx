/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Multi-select pack stem picker for Admin New World (options via props).
 * Invariants: No Old World chrome; no hard-coded domain catalogs inside the atom.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useState } from 'react';

import { cn } from '@/utils/cn';

import { AdminButton } from './AdminButton';
import { AdminField } from './AdminField';
import { AdminToggle } from './AdminToggle';

export type PackStemPickerProps = {
	options: readonly string[];
	value: string[];
	onChange: (next: string[]) => void;
	disabled?: boolean;
	className?: string;
	/** Label for custom stem field. */
	customLabel?: string;
	addLabel?: string;
};

export function PackStemPicker({
	options,
	value,
	onChange,
	disabled = false,
	className,
	customLabel = 'Custom stem',
	addLabel = 'Add',
}: PackStemPickerProps) {
	const [custom, setCustom] = useState('');
	const selected = new Set(value);

	const toggle = (stem: string, on: boolean) => {
		if (on) {
			if (selected.has(stem)) return;
			onChange([...value, stem]);
			return;
		}
		onChange(value.filter((s) => s !== stem));
	};

	const addCustom = () => {
		const stem = custom.trim();
		if (!stem || selected.has(stem)) return;
		onChange([...value, stem]);
		setCustom('');
	};

	return (
		<div className={cn('space-y-2', className)}>
			<div className="flex flex-wrap gap-x-4 gap-y-2">
				{options.map((stem) => (
					<AdminToggle
						key={stem}
						label={stem}
						disabled={disabled}
						checked={selected.has(stem)}
						onChange={(e) => toggle(stem, e.target.checked)}
					/>
				))}
			</div>
			<div className="flex flex-wrap items-end gap-2">
				<div className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
					<span id="admin-ui-pack-stem-custom-label">{customLabel}</span>
					<AdminField
						aria-labelledby="admin-ui-pack-stem-custom-label"
						value={custom}
						disabled={disabled}
						onChange={(e) => setCustom(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addCustom();
							}
						}}
					/>
				</div>
				<AdminButton
					variant="secondary"
					disabled={disabled || !custom.trim()}
					onClick={addCustom}
				>
					{addLabel}
				</AdminButton>
			</div>
			{value.length > 0 ? (
				<p className="text-[length:var(--admin-ui-text-xs)] text-[var(--admin-ui-fg-dim)]">
					Selected: {value.join(', ')}
				</p>
			) : (
				<p className="text-[length:var(--admin-ui-text-xs)] text-[var(--admin-ui-fg-dim)]">
					No pack stems selected
				</p>
			)}
		</div>
	);
}
