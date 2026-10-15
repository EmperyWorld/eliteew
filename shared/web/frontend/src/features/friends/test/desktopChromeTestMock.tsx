import {
	forwardRef,
	type ButtonHTMLAttributes,
	type HTMLAttributes,
	type ReactNode,
} from 'react';

const DesktopAppButton = forwardRef<
	HTMLButtonElement,
	ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: string;
		size?: string;
	}
>(({ children, className, type = 'button', ...rest }, ref) => (
	<button ref={ref} type={type} className={className} {...rest}>
		{children}
	</button>
));
DesktopAppButton.displayName = 'DesktopAppButton';

/** Minimal Desktop chrome for friends feature tests (avoids heavy CVA / desktop tree). */
export const desktopChromeTestMock = {
	DesktopAppPanel: ({
		children,
		className,
		...rest
	}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
		<div data-testid="desktop-app-panel" className={className} {...rest}>
			{children}
		</div>
	),
	DesktopAppButton,
	DesktopAppEmptyState: ({
		title,
		description,
		className,
	}: {
		title?: string;
		description?: string;
		className?: string;
	}) => (
		<div data-testid="desktop-empty-state" className={className}>
			{title ? <span>{title}</span> : null}
			{description ? <span>{description}</span> : null}
		</div>
	),
	DesktopAppListRow: ({
		children,
		onClick,
		disabled,
		type,
		className,
		...rest
	}: ButtonHTMLAttributes<HTMLButtonElement> & {
		type?: 'button' | 'submit';
	}) => (
		<button
			type={type ?? 'button'}
			onClick={onClick}
			disabled={disabled}
			className={className}
			{...rest}
		>
			{children}
		</button>
	),
	DesktopAppSectionLabel: ({ children }: { children?: ReactNode }) => (
		<span data-testid="section-label">{children}</span>
	),
	DesktopAppToolbar: ({
		children,
		className,
	}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
		<div data-testid="desktop-toolbar" className={className}>
			{children}
		</div>
	),
	DesktopAppSkeleton: ({ className }: { className?: string }) => (
		<div data-testid="desktop-skeleton" className={className} />
	),
	DesktopAppStatusBadge: ({
		children,
		className,
	}: HTMLAttributes<HTMLSpanElement>) => (
		<span data-testid="desktop-status-badge" className={className}>
			{children}
		</span>
	),
};
