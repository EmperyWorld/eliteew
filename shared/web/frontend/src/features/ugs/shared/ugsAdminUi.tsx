/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reusable layout primitives and small helpers for UGS admin panels (modal, fields, badges).
 *
 * Invariants:
 * - Modal z-index follows desktop portal stack when embedded in a desktop window.
 *
 * Related:
 * - src/features/ugs/shared/ugsAdminConstants.ts
 * - src/pages/Desktop/context/DesktopWindowPortalStackContext.tsx
 */

import * as React from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { UGS_ADMIN_NS } from '@/i18n/namespaces';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';

import { badgeClasses, buttonClasses } from './ugsAdminConstants';
import {
	UGS_DESKTOP_FORM,
	UGS_DESKTOP_SURFACE,
} from '@/features/ugs/shared/ugsDesktopUi';
import type {
	UgsAdminBadgeVariant,
	UgsAdminButtonVariant,
} from './ugsAdminUiTypes';

export function isUgsTextLlmProviderType(
	t: string | undefined | null
): boolean {
	return t === 'llama' || t === 'llama';
}

export function formatDate(
	value?: string | null,
	locale?: string | null
): string {
	if (!value) {
		return '—';
	}
	const resolvedLocale = locale?.toLowerCase().startsWith('en')
		? 'en-US'
		: 'ru-RU';
	try {
		return new Date(value).toLocaleString(resolvedLocale, { hour12: false });
	} catch {
		return value;
	}
}

export function jsonString(data: unknown): string {
	try {
		return JSON.stringify(data ?? {}, null, 2);
	} catch {
		return '{}';
	}
}

export function parseJsonInput(
	value: string,
	invalidJsonMessage = 'Invalid JSON'
): Record<string, unknown> {
	try {
		if (!value.trim()) {
			return {};
		}
		const parsed = JSON.parse(value) as unknown;
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			!Array.isArray(parsed)
		) {
			return parsed as Record<string, unknown>;
		}
		return {};
	} catch {
		throw new Error(invalidJsonMessage);
	}
}

export const Modal: React.FC<{
	open: boolean;
	title: string;
	onClose: () => void;
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
	children: React.ReactNode;
}> = ({ open, title, onClose, size = 'md', children }) => {
	const { t } = useTranslation(UGS_ADMIN_NS);
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	if (!open) {
		return null;
	}
	const sizeMap: Record<string, string> = {
		sm: 'max-w-md',
		md: 'max-w-2xl',
		lg: 'max-w-3xl',
		xl: 'max-w-5xl',
		full: 'max-w-6xl',
	};
	return (
		<div
			className="fixed inset-0 flex items-center justify-center px-4 py-6"
			style={{ zIndex: embeddedModalZ.backdrop }}
		>
			<button
				type="button"
				className="absolute inset-0 bg-black/45"
				onClick={onClose}
				aria-label={t('common.closeDialog')}
			/>
			<div
				className={`relative w-full min-w-0 rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-primary) shadow-(--desktop-shadow-panel) ${sizeMap[size]}`}
				style={{ zIndex: embeddedModalZ.content }}
			>
				<div className="flex items-center justify-between border-b border-(--desktop-border-subtle) px-6 py-4">
					<h2 className="min-w-0 text-lg font-semibold text-(--desktop-text-primary)">
						{title}
					</h2>
					<button
						type="button"
						className="rounded-lg p-2 text-(--desktop-text-muted) transition hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)"
						onClick={onClose}
						aria-label={t('common.close')}
					>
						×
					</button>
				</div>
				<div className="max-h-[70vh] min-w-0 overflow-y-auto px-6 py-5 text-sm text-(--desktop-text-secondary)">
					<div className="min-w-0 space-y-4">{children}</div>
				</div>
			</div>
		</div>
	);
};

export const Section: React.FC<{
	title?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}> = ({ title, action, children }) => (
	<div className={cn(UGS_DESKTOP_SURFACE.panel, 'p-6 sm:p-7')}>
		{(title || action) && (
			<div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-(--desktop-border-subtle) pb-5 sm:mb-6">
				{title && (
					<h2 className="min-w-0 text-lg font-semibold tracking-tight text-(--desktop-text-primary)">
						{title}
					</h2>
				)}
				{action}
			</div>
		)}
		<div className="min-w-0">{children}</div>
	</div>
);

export const Badge: React.FC<{
	variant?: UgsAdminBadgeVariant;
	children: React.ReactNode;
	icon?: React.ReactNode;
}> = ({ variant = 'default', children, icon }) => (
	<span
		className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClasses[variant]}`}
	>
		{icon && <span className="shrink-0 opacity-90">{icon}</span>}
		{children}
	</span>
);

export const Button: React.FC<
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: UgsAdminButtonVariant;
		iconLeft?: React.ReactNode;
		size?: 'sm' | 'md' | 'lg';
	}
> = ({
	variant = 'primary',
	iconLeft,
	size = 'md',
	className = '',
	children,
	...props
}) => {
	const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-4 py-2 text-sm',
		lg: 'px-6 py-3 text-base',
	};

	return (
		<button
			className={`inline-flex items-center gap-2 rounded-lg font-medium transition focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.4)] disabled:cursor-not-allowed disabled:opacity-60 ${buttonClasses[variant]} ${sizeClasses[size]} ${className}`}
			{...props}
		>
			{iconLeft && <span className="text-current">{iconLeft}</span>}
			<span>{children}</span>
		</button>
	);
};

export const InputField: React.FC<
	React.InputHTMLAttributes<HTMLInputElement> & {
		label: string;
		hint?: string;
		error?: string;
	}
> = ({ label, hint, error, className = '', id: idProp, ...props }) => {
	const genId = useId();
	const hintId = useId();
	const errId = useId();
	const inputId = idProp ?? genId;
	const describedBy = [hint ? hintId : null, error ? errId : null]
		.filter(Boolean)
		.join(' ');
	return (
		<div className={UGS_DESKTOP_FORM.field}>
			<label htmlFor={inputId} className={UGS_DESKTOP_FORM.label}>
				{label}
			</label>
			<input
				id={inputId}
				aria-describedby={describedBy || undefined}
				className={cn(
					UGS_DESKTOP_FORM.input,
					error && 'border-rose-400/45',
					className
				)}
				{...props}
			/>
			{hint ? (
				<span id={hintId} className={UGS_DESKTOP_FORM.hint}>
					{hint}
				</span>
			) : null}
			{error ? (
				<span
					id={errId}
					role="alert"
					className="text-xs text-rose-600 dark:text-rose-300"
				>
					{error}
				</span>
			) : null}
		</div>
	);
};

export const TextAreaField: React.FC<
	React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
		label: string;
		hint?: string;
		error?: string;
	}
> = ({ label, hint, error, className = '', id: idProp, ...props }) => {
	const genId = useId();
	const hintId = useId();
	const errId = useId();
	const areaId = idProp ?? genId;
	const describedBy = [hint ? hintId : null, error ? errId : null]
		.filter(Boolean)
		.join(' ');
	return (
		<div className={UGS_DESKTOP_FORM.field}>
			<label htmlFor={areaId} className={UGS_DESKTOP_FORM.label}>
				{label}
			</label>
			<textarea
				id={areaId}
				aria-describedby={describedBy || undefined}
				className={cn(
					UGS_DESKTOP_FORM.textarea,
					error && 'border-rose-400/45',
					className
				)}
				{...props}
			/>
			{hint ? (
				<span id={hintId} className={UGS_DESKTOP_FORM.hint}>
					{hint}
				</span>
			) : null}
			{error ? (
				<span
					id={errId}
					role="alert"
					className="text-xs text-rose-600 dark:text-rose-300"
				>
					{error}
				</span>
			) : null}
		</div>
	);
};

export const CheckboxField: React.FC<
	React.InputHTMLAttributes<HTMLInputElement> & { label: string }
> = ({ label, className = '', ...props }) => (
	<label
		className={cn(
			'flex items-center gap-2 text-sm text-(--desktop-text-secondary)',
			className
		)}
	>
		<input
			type="checkbox"
			className="h-4 w-4 rounded-sm border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-[rgb(var(--desktop-accent-rgb))] focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.45)]"
			{...props}
		/>
		<span>{label}</span>
	</label>
);
