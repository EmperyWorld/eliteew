import * as React from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

export interface CheckboxProps {
	checked?: boolean;
	onChange?: (checked: boolean) => void;
	label?: string;
	disabled?: boolean;
	className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
	checked = false,
	onChange,
	label,
	disabled = false,
	className,
}) => (
	<label
		className={cn(
			'inline-flex items-center gap-2',
			disabled ? 'opacity-60' : 'cursor-pointer',
			className
		)}
	>
		<span className="relative inline-flex h-5 w-5 items-center justify-center">
			<input
				type="checkbox"
				className="sr-only"
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange?.(event.target.checked)}
			/>
			<span
				className={cn(
					'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
					checked
						? 'border-[rgb(var(--desktop-accent-rgb))] bg-[rgb(var(--desktop-accent-rgb))] text-white'
						: 'border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-transparent'
				)}
			>
				<CheckIcon className="h-3.5 w-3.5" />
			</span>
		</span>
		{label ? (
			<span className="text-sm text-(--desktop-text-primary)">{label}</span>
		) : null}
	</label>
);
