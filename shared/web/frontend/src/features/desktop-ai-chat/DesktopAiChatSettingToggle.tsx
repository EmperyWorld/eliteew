/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Settings-panel toggle row for Desktop AI Chat (mini switch + label).
 *
 * Invariants:
 * - Optional hint uses DesktopChromeTooltip when styled tooltips are enabled.
 *
 * Related:
 * - DesktopAiChatApp.tsx · DesktopChromeTooltip.tsx
 */
import * as React from 'react';

import { cn } from '@/utils/cn';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';

type DesktopAiChatSettingToggleProps = {
	checked: boolean;
	onChange: (next: boolean) => void;
	children: React.ReactNode;
	title?: string;
	onBlur?: () => void;
	disabled?: boolean;
	/** Уникальный id для связи label-input (a11y) */
	inputId: string;
};

/**
 * Переключатель для панели настроек чата: мини-тумблер + подпись, без системного чекбокса.
 */
export function DesktopAiChatSettingToggle({
	checked,
	onChange,
	children,
	title,
	onBlur,
	disabled = false,
	inputId,
}: DesktopAiChatSettingToggleProps) {
	const label = (
		<label
			htmlFor={inputId}
			className={cn(
				'inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 py-1 antialiased',
				'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)]',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
				'transition-[border-color,background-color,box-shadow] duration-200',
				disabled
					? 'cursor-not-allowed opacity-50'
					: [
							'cursor-pointer',
							'hover:border-white/18 hover:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_72%,transparent)]',
							'has-focus-visible:ring-2 has-focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] has-focus-visible:ring-offset-1 has-focus-visible:ring-offset-transparent',
						].join(' '),
				checked
					? 'border-[rgb(var(--desktop-accent-rgb)/0.42)] bg-[rgb(var(--desktop-accent-rgb)/0.14)]'
					: 'border-white/12'
			)}
		>
			<input
				id={inputId}
				type="checkbox"
				checked={checked}
				disabled={disabled}
				onChange={(e) => onChange(e.target.checked)}
				onBlur={onBlur}
				className="sr-only"
			/>
			<span
				aria-hidden
				className={[
					'relative inline-flex h-4 w-6 shrink-0 rounded-full border transition-colors duration-200',
					checked
						? 'border-[rgb(var(--desktop-accent-rgb)/0.5)] bg-[rgb(var(--desktop-accent-rgb)/0.5)]'
						: 'border-white/18 bg-black/45',
				].join(' ')}
			>
				<span
					className={[
						'absolute top-1/2 block h-2.5 w-2.5 -translate-y-1/2 rounded-full shadow-sm transition-all duration-200 motion-reduce:transition-none',
						checked
							? 'left-[2px] translate-x-[0.7rem] bg-white shadow-[0_0_10px_rgb(var(--desktop-accent-rgb)/0.35)]'
							: 'left-[2px] translate-x-0 bg-white/50',
					].join(' ')}
				/>
			</span>
			<span
				className={[
					'select-none text-xs leading-tight',
					checked
						? 'font-medium text-(--desktop-text-primary)'
						: 'text-(--desktop-text-secondary)',
				].join(' ')}
			>
				{children}
			</span>
		</label>
	);

	if (!title?.trim()) {
		return label;
	}

	return (
		<DesktopChromeTooltip content={title} placement="top" offsetExtra={4}>
			{label}
		</DesktopChromeTooltip>
	);
}
