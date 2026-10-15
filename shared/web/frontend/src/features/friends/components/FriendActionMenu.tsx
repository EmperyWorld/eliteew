import type { ReactNode } from 'react';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export interface FriendActionDescriptor {
	id: string;
	label: string;
	icon: ReactNode;
	onClick: () => void | Promise<void>;
	disabled?: boolean;
	title?: string;
	variant?: 'ghost' | 'neutral' | 'accent';
	size?: 'sm' | 'icon';
	showLabel?: boolean;
	className?: string;
}

interface FriendActionMenuProps {
	actions: FriendActionDescriptor[];
}

export function FriendActionMenu({
	actions,
}: FriendActionMenuProps): JSX.Element | null {
	if (actions.length === 0) {
		return null;
	}

	return (
		<div className="flex items-center gap-1 shrink-0">
			{actions.map((action) => (
				<DesktopAppButton
					key={action.id}
					onClick={() => {
						void action.onClick();
					}}
					variant={action.variant ?? 'ghost'}
					size={action.size ?? 'icon'}
					className={cn(
						action.size === 'icon' || !action.showLabel
							? 'min-h-11 min-w-11'
							: 'min-h-11',
						action.className
					)}
					title={action.title ?? action.label}
					aria-label={action.label}
					disabled={action.disabled}
				>
					{action.icon}
					{action.showLabel ? <span>{action.label}</span> : null}
				</DesktopAppButton>
			))}
		</div>
	);
}
