import { useId, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

interface FieldLabelProps {
	label: string;
	hint?: string;
	required?: boolean;
	children: ReactNode;
}

/** Подпись над полем, когда контрол лежит соседним узлом (не внутри native `<label>`). */
export function InputLabel({
	children,
	hint,
	required,
	className,
	id,
	htmlFor,
}: {
	children: ReactNode;
	hint?: string;
	required?: boolean;
	className?: string;
	id?: string;
	/** Связь с одиночным input/select/textarea по id. */
	htmlFor?: string;
}) {
	const inner = (
		<>
			{children}
			{required ? (
				<span
					className="ml-0.5 align-top text-[0.7rem] leading-none text-red-400/90"
					aria-hidden="true"
				>
					*
				</span>
			) : null}
			{hint ? (
				<span className="ml-1.5 font-normal leading-snug text-(--desktop-text-dim)">
					{hint}
				</span>
			) : null}
		</>
	);
	const classNames = cn(
		'block text-xs font-medium leading-snug tracking-wide text-(--desktop-text-secondary)',
		className
	);
	if (htmlFor) {
		return (
			<label htmlFor={htmlFor} id={id} className={classNames}>
				{inner}
			</label>
		);
	}
	return (
		<span id={id} className={classNames}>
			{inner}
		</span>
	);
}

export function FieldLabel({
	label,
	hint,
	required,
	children,
}: FieldLabelProps) {
	const labelId = useId();
	return (
		<fieldset
			className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
			aria-labelledby={labelId}
		>
			<span
				id={labelId}
				className="text-xs font-medium leading-snug tracking-wide text-(--desktop-text-secondary)"
			>
				{label}
				{required ? (
					<span
						className="ml-0.5 align-top text-[0.7rem] leading-none text-red-400/90"
						aria-hidden="true"
					>
						*
					</span>
				) : null}
				{hint ? (
					<span className="ml-1.5 font-normal leading-snug text-(--desktop-text-dim)">
						{hint}
					</span>
				) : null}
			</span>
			{children}
		</fieldset>
	);
}
