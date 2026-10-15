import * as React from 'react';
import { Link } from 'react-router';
import { useAdminNavigate } from '../AdminEmbeddedRouter';
import { useIsDesktopEmbeddedAdmin } from '../AdminShellModeContext';

interface AdminLinkProps
	extends Omit<
		React.AnchorHTMLAttributes<HTMLAnchorElement>,
		'href' | 'onClick'
	> {
	to: string;
	onClick?: (event: React.MouseEvent<HTMLElement>) => void;
}

export const AdminLink: React.FC<React.PropsWithChildren<AdminLinkProps>> = ({
	to,
	target,
	rel,
	className,
	title,
	children,
	onClick,
	...rest
}) => {
	const navigate = useAdminNavigate();
	const isDesktopEmbedded = useIsDesktopEmbeddedAdmin();
	const isEmbeddedAdminRoute =
		isDesktopEmbedded && to.startsWith('/admin') && !target;

	if (isEmbeddedAdminRoute) {
		return (
			<button
				type="button"
				data-embedded-admin-route={to}
				className={className}
				title={title}
				onClick={(event) => {
					onClick?.(event);
					if (!event.defaultPrevented) {
						navigate(to);
					}
				}}
				{...(rest as Omit<
					React.ButtonHTMLAttributes<HTMLButtonElement>,
					'onClick' | 'type'
				>)}
			>
				{children}
			</button>
		);
	}

	if (target) {
		return (
			<a
				href={to}
				target={target}
				rel={rel}
				className={className}
				title={title}
				onClick={
					onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined
				}
				{...rest}
			>
				{children}
			</a>
		);
	}

	return (
		<Link
			to={to}
			className={className}
			title={title}
			onClick={
				onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined
			}
			{...rest}
		>
			{children}
		</Link>
	);
};
