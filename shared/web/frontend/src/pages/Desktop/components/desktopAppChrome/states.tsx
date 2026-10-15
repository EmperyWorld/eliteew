/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop app empty/error/skeleton states, badges, and content wrapper shell.
 *
 * Invariants:
 * - Primitive fallback copy comes from shared i18n namespaces.
 *
 * Related:
 * - desktopAppChrome/styleContract.ts
 * - desktopAppChrome/controls.tsx
 */

import { cn } from '@/utils/cn';
import { COMMON_UI_NS } from '@/i18n/namespaces';
import { useTranslation } from 'react-i18next';
import type { HTMLAttributes, ReactNode } from 'react';
import type { DesktopWindowStyle } from '../../../../types/profile';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellPanelClassName,
} from '../../utils/desktopVisualSystem';
import { DesktopAppButton } from './controls';
import {
	type DesktopAppSurfaceMode,
	DESKTOP_APP_STYLE_CONTRACT,
	getDesktopAppFamily,
	getDesktopAppSurfaceMode,
} from './styleContract';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

interface DesktopAppEmptyStateProps
	extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
	icon?: ReactNode;
	title?: ReactNode;
	description?: ReactNode;
}

export const DesktopAppEmptyState: React.FC<DesktopAppEmptyStateProps> = ({
	className,
	icon,
	title,
	description,
	children,
	...props
}) => (
	<div
		className={cn(
			'flex flex-col items-center justify-center gap-4 p-8 text-center',
			className
		)}
		{...props}
	>
		{icon ? (
			<div className={DESKTOP_APP_STYLE_CONTRACT.emptyIcon}>{icon}</div>
		) : null}
		{title ? (
			<div className="text-sm font-medium text-(--desktop-text-secondary)">
				{title}
			</div>
		) : null}
		{description ? (
			<div className="max-w-xs text-sm leading-relaxed text-(--desktop-text-muted)">
				{description}
			</div>
		) : null}
		{children}
	</div>
);

interface DesktopAppErrorStateProps {
	message: ReactNode;
	actionLabel?: string;
	onAction?: () => void;
}

export const DesktopAppErrorState: React.FC<DesktopAppErrorStateProps> = ({
	message,
	actionLabel,
	onAction,
}) => {
	const { t } = useTranslation(COMMON_UI_NS);
	return (
		<div className="flex items-start gap-3 border-b border-[color-mix(in_srgb,rgb(239_68_68)_40%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(239_68_68)_12%,var(--desktop-surface-panel-strong))] px-4 py-4 text-sm text-(--desktop-text-primary)">
			<div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[rgb(239_68_68)] shadow-[0_0_10px_color-mix(in_srgb,rgb(239_68_68)_75%,transparent)]" />
			<div className="flex-1">
				<p>{message}</p>
				{onAction ? (
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={onAction}
						className="mt-2 border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)"
					>
						{actionLabel ?? t('actions.retry')}
					</DesktopAppButton>
				) : null}
			</div>
		</div>
	);
};

export const DesktopAppSkeleton: React.FC<HTMLAttributes<HTMLDivElement>> = ({
	className,
	...props
}) => (
	<div
		className={cn(
			'motion-safe:animate-pulse motion-reduce:animate-none rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
			className
		)}
		{...props}
	/>
);

export const DesktopAppStatusBadge: React.FC<
	HTMLAttributes<HTMLSpanElement>
> = ({ className, ...props }) => (
	<span
		className={cn(
			'inline-flex items-center rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 font-medium',
			DESKTOP_TYPOGRAPHY.small,
			'text-(--desktop-text-secondary)',
			className
		)}
		{...props}
	/>
);

interface DesktopAppContentWrapperProps extends HTMLAttributes<HTMLDivElement> {
	appComponent?: string | null;
	mode?: DesktopAppSurfaceMode;
	/** Согласован с ПКМ → стиль окон (рамка оболочки — см. {@link getDesktopShellPanelClassName}) */
	windowStyle?: DesktopWindowStyle;
}

export const DesktopAppContentWrapper: React.FC<
	DesktopAppContentWrapperProps
> = ({
	appComponent,
	mode,
	windowStyle = 'glass',
	className,
	children,
	...props
}) => {
	const resolvedMode = mode ?? getDesktopAppSurfaceMode(appComponent);

	if (resolvedMode === 'passthrough') {
		return (
			<div
				className={cn('h-full min-h-0', className)}
				data-desktop-app-surface="passthrough"
				{...props}
			>
				{children}
			</div>
		);
	}

	if (resolvedMode === 'framed') {
		return (
			<div
				className={cn(
					'flex h-full min-h-0 flex-col text-(--desktop-text-primary)',
					className
				)}
				data-desktop-app-surface="framed"
				data-desktop-app-family={getDesktopAppFamily(appComponent)}
				{...props}
			>
				<div
					className={cn(
						'h-full min-h-0 min-w-0 flex-1 overflow-hidden flex flex-col',
						getDesktopShellContentPanelClassName(windowStyle)
					)}
				>
					{children}
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				'h-full min-h-0 px-3 py-3 text-(--desktop-text-primary) md:px-4 md:py-4',
				className
			)}
			data-desktop-app-surface="standard"
			data-desktop-app-family={getDesktopAppFamily(appComponent)}
			{...props}
		>
			<div
				className={cn(
					'h-full min-h-0 overflow-hidden',
					getDesktopShellPanelClassName(windowStyle, 'strong')
				)}
			>
				{children}
			</div>
		</div>
	);
};
