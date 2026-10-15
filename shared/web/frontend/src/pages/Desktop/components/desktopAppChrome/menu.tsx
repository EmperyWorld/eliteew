/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop context menu and dropdown menu chrome primitives.
 *
 * Invariants:
 * - Menu surfaces follow shell frame preset (glass / framed / minimal).
 *
 * Related:
 * - desktopAppChrome/styleContract.ts
 */

import { cn } from '@/utils/cn';
import { cva, type VariantProps } from '@/utils/cva';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import type { DesktopWindowStyle } from '../../../../types/profile';
import { useDesktopShellFrame } from '../../context/DesktopShellFrameContext';
import { getDesktopShellContextMenuClassName } from '../../utils/desktopVisualSystem';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from './styleContract';

/** Экспорт для меню, где статический a11y-анализатор должен «видеть» `role="menuitem"` на нативном `button`. */
export const menuItemVariants = cva(
	cn(
		'mx-0.5 flex w-[calc(100%-0.25rem)] items-center gap-3 rounded-[calc(var(--desktop-radius)-2px)] px-2.5 py-2 text-left font-medium leading-tight transition-colors duration-200 motion-reduce:transition-none',
		DESKTOP_TYPOGRAPHY.shellCopy13,
		DESKTOP_CHROME_FOCUS_VISIBLE,
		'disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-[0.7] disabled:grayscale-[0.15]'
	),
	{
		variants: {
			tone: {
				default:
					'text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary) active:bg-(--desktop-surface-soft-active)',
				danger:
					'text-[color-mix(in_srgb,rgb(220_38_38)_78%,var(--desktop-text-primary))] hover:bg-[color-mix(in_srgb,rgb(239_68_68)_12%,var(--desktop-surface-soft))] hover:text-(--desktop-text-primary) focus-visible:ring-[color-mix(in_srgb,rgb(239_68_68)_45%,transparent)]',
				active: 'bg-(--desktop-surface-accent) text-(--desktop-text-primary)',
			},
		},
		defaultVariants: {
			tone: 'default',
		},
	}
);

interface DesktopAppMenuSurfaceProps extends HTMLAttributes<HTMLDivElement> {
	/** Явный пресет (например из родителя); иначе — {@link useDesktopShellFrame}. */
	windowStyle?: DesktopWindowStyle;
	/**
	 * `false` — не обрезать содержимое по округлению контейнера (выпады рядом с меню).
	 * Нужно для контекстного меню со вложенными flyout-слоями; по умолчанию `true`.
	 */
	clipOverflow?: boolean;
}

/** ПКМ и выпадающие меню — фон/рамка по пресету «Стиль окон» (glass / framed / minimal). */
export const DesktopAppMenuSurface: React.FC<DesktopAppMenuSurfaceProps> = ({
	className,
	windowStyle: windowStyleProp,
	clipOverflow = true,
	...props
}) => {
	const shellFrameFromContext = useDesktopShellFrame();
	const shellFrame = windowStyleProp ?? shellFrameFromContext;
	return (
		<div
			className={cn(
				getDesktopShellContextMenuClassName(shellFrame, { clipOverflow }),
				'min-w-[220px]',
				className
			)}
			{...props}
		/>
	);
};

export interface DesktopAppMenuHeaderProps
	extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
	/** Верхняя строка мелким капсом (часто `DesktopAppSectionLabel`) */
	eyebrow?: ReactNode;
	/** Основной заголовок (строка или произвольный узел) */
	title?: ReactNode;
	/** Подзаголовок */
	subtitle?: ReactNode;
	/** Слева: иконка приложения и т.п. */
	leading?: ReactNode;
	/** Справа: бейдж, мета */
	trailing?: ReactNode;
}

/** Единая шапка для контекстных меню (Пуск, редактор, …) */
export const DesktopAppMenuHeader: React.FC<DesktopAppMenuHeaderProps> = ({
	className,
	eyebrow,
	title,
	subtitle,
	leading,
	trailing,
	...props
}) => (
	<div
		role="presentation"
		className={cn(
			'relative overflow-hidden border-b border-[color-mix(in_srgb,var(--desktop-border-menu)_30%,transparent)] bg-(--desktop-surface-soft)/40 px-3 py-2.5',
			className
		)}
		{...props}
	>
		<div
			className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgb(var(--desktop-accent-rgb)/0.08),transparent_55%)]"
			aria-hidden
		/>
		<div
			className={cn(
				'relative flex gap-3',
				leading ? 'items-center' : 'items-start',
				trailing ? 'justify-between' : ''
			)}
		>
			{leading ? <div className="shrink-0">{leading}</div> : null}
			<div className="min-w-0 flex-1">
				{eyebrow ? <div className="mb-0.5">{eyebrow}</div> : null}
				{title != null ? (
					typeof title === 'string' ? (
						<DesktopChromeTooltip
							content={title}
							placement="top"
							offsetExtra={4}
						>
							<p className="desktop-shell-display-text truncate text-sm font-semibold tracking-tight text-(--desktop-text-primary)">
								{title}
							</p>
						</DesktopChromeTooltip>
					) : (
						title
					)
				) : null}
				{subtitle != null ? (
					typeof subtitle === 'string' ? (
						<DesktopChromeTooltip
							content={subtitle}
							placement="top"
							offsetExtra={4}
						>
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'mt-0.5 truncate text-(--desktop-text-muted)',
									!title && !eyebrow ? 'mt-0' : ''
								)}
							>
								{subtitle}
							</p>
						</DesktopChromeTooltip>
					) : (
						subtitle
					)
				) : null}
			</div>
			{trailing ? <div className="relative shrink-0">{trailing}</div> : null}
		</div>
	</div>
);

/** Uppercase section stripe at top of a context menu (e.g. «Переместить…») */
export const DesktopAppMenuSectionLabel: React.FC<
	HTMLAttributes<HTMLDivElement>
> = ({ className, children, ...props }) => (
	<div
		role="presentation"
		className={cn(
			'border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-3 py-2',
			className
		)}
		{...props}
	>
		<span className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}>{children}</span>
	</div>
);

/** Single-line title for ПКМ over a named item (file, row, …) */
export const DesktopAppContextMenuTitle: React.FC<
	HTMLAttributes<HTMLDivElement>
> = ({ className, children, ...props }) => (
	<div
		role="presentation"
		className={cn(
			'border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 px-3 py-2.5 text-sm font-medium text-(--desktop-text-primary)',
			className
		)}
		{...props}
	>
		{typeof children === 'string' ? (
			<DesktopChromeTooltip content={children} placement="top" offsetExtra={4}>
				<span className="block truncate">{children}</span>
			</DesktopChromeTooltip>
		) : (
			children
		)}
	</div>
);

interface DesktopAppMenuItemProps
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof menuItemVariants> {
	icon?: ReactNode;
	shortcut?: ReactNode;
	badge?: ReactNode;
	hasSubmenu?: boolean;
}

export const DesktopAppMenuItem: React.FC<DesktopAppMenuItemProps> = ({
	className,
	tone,
	icon,
	shortcut,
	badge,
	hasSubmenu,
	children,
	...props
}) => {
	const labelNode =
		typeof children === 'string' ? (
			<DesktopChromeTooltip
				content={children}
				placement="right"
				offsetExtra={4}
			>
				<span className="truncate">{children}</span>
			</DesktopChromeTooltip>
		) : (
			<span className="truncate">{children}</span>
		);

	return (
		<button className={cn(menuItemVariants({ tone }), className)} {...props}>
			<span className="flex min-w-0 flex-1 items-center gap-3">
				{icon ? (
					<span
						className={cn(
							'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-(--desktop-surface-soft) text-(--desktop-text-muted) [&_svg]:stroke-[1.35]',
							tone === 'danger'
								? 'bg-[color-mix(in_srgb,rgb(239_68_68)_10%,var(--desktop-surface-soft))] text-[color-mix(in_srgb,rgb(248_113_113)_65%,var(--desktop-text-muted))]'
								: ''
						)}
						aria-hidden="true"
					>
						{icon}
					</span>
				) : null}
				{labelNode}
				{badge ? (
					<span className={cn(DESKTOP_TYPOGRAPHY.meta, 'ml-2')}>{badge}</span>
				) : null}
			</span>
			<span className="flex shrink-0 items-center gap-2 text-xs text-(--desktop-text-dim)">
				{shortcut}
				{hasSubmenu ? <span aria-hidden>›</span> : null}
			</span>
		</button>
	);
};

export const DesktopAppMenuDivider: React.FC<HTMLAttributes<HTMLHRElement>> = ({
	className,
	...props
}) => (
	<hr
		className={cn(
			'mx-2 my-1.5 border-0 border-t border-[color-mix(in_srgb,var(--desktop-border-menu)_35%,transparent)]',
			className
		)}
		{...props}
	/>
);
