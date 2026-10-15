/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop product workspace shell: header, status banner, state panel, next action.
 *
 * Invariants:
 * - Primitive fallback copy comes from shared i18n namespaces.
 *
 * Related:
 * - desktopAppChrome/surfaces.tsx
 * - desktopAppChrome/controls.tsx
 * - desktopAppChrome/states.tsx
 */

import { cn } from '@/utils/cn';
import { COMMON_UI_NS } from '@/i18n/namespaces';
import { useTranslation } from 'react-i18next';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { DesktopAppSectionLabel } from './controls';
import { DesktopAppSurface } from './surfaces';
import { DesktopAppEmptyState } from './states';

export interface DesktopProductWorkspaceProps
	extends HTMLAttributes<HTMLDivElement> {
	header?: ReactNode;
	toolbar?: ReactNode;
	status?: ReactNode;
	footer?: ReactNode;
	contentClassName?: string;
}

export const DesktopProductWorkspace = forwardRef<
	HTMLDivElement,
	DesktopProductWorkspaceProps
>(
	(
		{
			className,
			header,
			toolbar,
			status,
			children,
			footer,
			contentClassName,
			...props
		},
		ref
	) => (
		<div
			ref={ref}
			className={cn(
				'flex h-full min-h-0 flex-col overflow-hidden bg-transparent text-(--desktop-text-primary)',
				className
			)}
			{...props}
		>
			{header ? <div className="shrink-0">{header}</div> : null}
			{toolbar ? <div className="shrink-0">{toolbar}</div> : null}
			{status ? <div className="shrink-0">{status}</div> : null}
			<div className={cn('min-h-0 flex-1 overflow-y-auto', contentClassName)}>
				{children}
			</div>
			{footer ? <div className="shrink-0">{footer}</div> : null}
		</div>
	)
);
DesktopProductWorkspace.displayName = 'DesktopProductWorkspace';

export interface DesktopProductHeaderProps
	extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
	eyebrow?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	meta?: ReactNode;
}

export const DesktopProductHeader: React.FC<DesktopProductHeaderProps> = ({
	className,
	eyebrow,
	title,
	description,
	actions,
	meta,
	...props
}) => (
	<header
		className={cn(
			'flex flex-wrap items-start justify-between gap-4 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 px-4 py-4',
			className
		)}
		{...props}
	>
		<div className="min-w-0 flex-1 space-y-1">
			{eyebrow ? (
				<DesktopAppSectionLabel>{eyebrow}</DesktopAppSectionLabel>
			) : null}
			{typeof title === 'string' ? (
				<DesktopChromeTooltip content={title} placement="top" offsetExtra={4}>
					<h1 className="desktop-shell-display-text truncate text-lg font-semibold tracking-tight text-(--desktop-text-primary)">
						{title}
					</h1>
				</DesktopChromeTooltip>
			) : (
				<h1 className="desktop-shell-display-text truncate text-lg font-semibold tracking-tight text-(--desktop-text-primary)">
					{title}
				</h1>
			)}
			{description ? (
				<p className="max-w-3xl text-sm leading-6 text-(--desktop-text-secondary)">
					{description}
				</p>
			) : null}
			{meta ? (
				<div className="text-xs leading-5 text-(--desktop-text-muted)">
					{meta}
				</div>
			) : null}
		</div>
		{actions ? (
			<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
				{actions}
			</div>
		) : null}
	</header>
);

export type DesktopProductStatusTone =
	| 'info'
	| 'success'
	| 'warning'
	| 'danger'
	| 'neutral';

const PRODUCT_STATUS_TONE_CLASS: Record<DesktopProductStatusTone, string> = {
	info: 'border-sky-400/25 bg-sky-500/10 text-sky-50',
	success: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-50',
	warning: 'border-amber-400/25 bg-amber-500/10 text-amber-50',
	danger: 'border-red-400/25 bg-red-500/10 text-red-50',
	neutral:
		'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)',
};

export interface DesktopProductStatusBannerProps
	extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
	tone?: DesktopProductStatusTone;
	title?: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
}

export const DesktopProductStatusBanner: React.FC<
	DesktopProductStatusBannerProps
> = ({
	className,
	tone = 'info',
	title,
	description,
	actions,
	children,
	role = 'status',
	'aria-live': ariaLive = 'polite',
	...props
}) => (
	<div
		role={role}
		aria-live={ariaLive}
		className={cn(
			'flex flex-wrap items-start justify-between gap-3 border px-4 py-3 text-sm',
			PRODUCT_STATUS_TONE_CLASS[tone],
			className
		)}
		{...props}
	>
		<div className="min-w-0 flex-1">
			{title ? <div className="font-medium">{title}</div> : null}
			{description ? (
				<div className="mt-1 leading-6 opacity-85">{description}</div>
			) : null}
			{children ? (
				<div className={title || description ? 'mt-2' : undefined}>
					{children}
				</div>
			) : null}
		</div>
		{actions ? (
			<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
				{actions}
			</div>
		) : null}
	</div>
);

export interface DesktopProductStatePanelProps
	extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
	state?:
		| 'empty'
		| 'loading'
		| 'error'
		| 'offline'
		| 'permissionDenied'
		| 'ready';
	icon?: ReactNode;
	title?: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
}

export const DesktopProductStatePanel: React.FC<
	DesktopProductStatePanelProps
> = ({
	className,
	state = 'empty',
	icon,
	title,
	description,
	actions,
	children,
	...props
}) => {
	const { t } = useTranslation(COMMON_UI_NS);
	const resolvedTitle = title ?? t(`states.${state}`);
	return (
		<DesktopAppEmptyState
			className={cn('min-h-72', className)}
			icon={icon}
			title={resolvedTitle}
			description={description}
			{...props}
		>
			{children}
			{actions ? (
				<div className="flex flex-wrap justify-center gap-2">{actions}</div>
			) : null}
		</DesktopAppEmptyState>
	);
};

export interface DesktopProductNextActionProps
	extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
}

export const DesktopProductNextAction: React.FC<
	DesktopProductNextActionProps
> = ({ className, title, description, actions, children, ...props }) => {
	const { t } = useTranslation(COMMON_UI_NS);
	return (
		<DesktopAppSurface
			variant="soft"
			padding="sm"
			className={cn(
				'border-[rgb(var(--desktop-accent-rgb))]/25 bg-(--desktop-surface-accent)',
				className
			)}
			{...props}
		>
			<DesktopAppSectionLabel>
				{t('workspace.nextAction')}
			</DesktopAppSectionLabel>
			<div className="mt-2 text-sm font-medium text-(--desktop-text-primary)">
				{title}
			</div>
			{description ? (
				<p className="mt-1 text-sm leading-6 text-(--desktop-text-secondary)">
					{description}
				</p>
			) : null}
			{children ? <div className="mt-3">{children}</div> : null}
			{actions ? (
				<div className="mt-3 flex flex-wrap gap-2">{actions}</div>
			) : null}
		</DesktopAppSurface>
	);
};
