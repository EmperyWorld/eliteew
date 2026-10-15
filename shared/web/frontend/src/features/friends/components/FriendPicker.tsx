import type { ReactNode } from 'react';
import {
	DesktopAppEmptyState,
	DesktopAppListRow,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { FriendAvatar, getFriendDisplayName } from './FriendAvatar';
import type { Friend } from '../types';
import { ArrowPathIcon, UsersIcon } from '@heroicons/react/24/outline';

interface FriendPickerProps {
	title: string;
	friends: Friend[];
	loading?: boolean;
	error?: string | null;
	emptyMessage: string;
	onPick?: (friend: Friend) => void;
	isPickDisabled?: (friend: Friend) => boolean;
	getHelperText?: (friend: Friend) => string | null;
	renderAction?: (friend: Friend) => ReactNode;
	className?: string;
}

export function FriendPicker({
	title,
	friends,
	loading = false,
	error = null,
	emptyMessage,
	onPick,
	isPickDisabled,
	getHelperText,
	renderAction,
	className = '',
}: FriendPickerProps): JSX.Element {
	return (
		<div className={className}>
			<div className="px-2 pb-1 flex items-center justify-between">
				<DesktopAppSectionLabel>{title}</DesktopAppSectionLabel>
				{loading ? (
					<ArrowPathIcon
						className="h-3 w-3 animate-spin text-(--desktop-text-muted)"
						aria-hidden
					/>
				) : null}
			</div>
			{error ? (
				<div className="px-2 pb-2 text-xs text-amber-300">{error}</div>
			) : null}
			{!loading && friends.length === 0 ? (
				<DesktopAppEmptyState
					className="py-4"
					icon={
						<UsersIcon
							className="h-6 w-6 text-(--desktop-text-dim)"
							aria-hidden
						/>
					}
					title={emptyMessage}
				/>
			) : (
				<div className="space-y-2">
					{friends.map((friend) => {
						const disabled = isPickDisabled?.(friend) ?? false;
						const helperText = getHelperText?.(friend) ?? null;
						const action = renderAction?.(friend);
						const content = (
							<>
								<div className="flex min-w-0 items-center gap-3">
									<FriendAvatar
										avatarUrl={friend.avatar_url}
										username={friend.username}
										fullName={friend.full_name}
										className="h-9 w-9"
										alt={title}
									/>
									<div className="min-w-0">
										<span className="block truncate text-sm font-medium text-(--desktop-text-primary)">
											{getFriendDisplayName(friend.username, friend.full_name)}
										</span>
										{helperText ? (
											<span className="block truncate text-[11px] text-(--desktop-text-muted)">
												{helperText}
											</span>
										) : null}
									</div>
								</div>
								{action}
							</>
						);

						if (onPick) {
							return (
								<DesktopAppListRow
									key={friend.id}
									type="button"
									onClick={() => onPick(friend)}
									disabled={disabled}
									className="flex items-center gap-3"
								>
									{content}
								</DesktopAppListRow>
							);
						}

						return (
							<div
								key={friend.id}
								className="flex items-center justify-between gap-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-3"
							>
								{content}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
