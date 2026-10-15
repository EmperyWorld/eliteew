/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Searchable checkbox lists for survey audience assignment (admin).
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import type { AccessGroupResponse } from '../../Desktop/services/desktopAdminApi';
import type { UserAppAccessGroupResponse } from '../../Desktop/services/desktopAdminApi';

const INPUT_CLASS = cn(
	'w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
	'bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
	'placeholder:text-(--desktop-text-dim)',
	'focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
);

type Props = {
	groups: AccessGroupResponse[];
	users: UserAppAccessGroupResponse[];
	groupIds: string[];
	userIds: string[];
	disabled?: boolean;
	onToggleGroup: (id: string) => void;
	onToggleUser: (id: string) => void;
};

export function filterAudienceGroups(
	groups: AccessGroupResponse[],
	query: string
): AccessGroupResponse[] {
	const q = query.trim().toLowerCase();
	if (!q) return groups;
	return groups.filter((g) => g.name.toLowerCase().includes(q));
}

export function filterAudienceUsers(
	users: UserAppAccessGroupResponse[],
	query: string
): UserAppAccessGroupResponse[] {
	const q = query.trim().toLowerCase();
	if (!q) return users;
	return users.filter(
		(u) =>
			u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
	);
}

export function SurveyAdminAudiencePicker({
	groups,
	users,
	groupIds,
	userIds,
	disabled = false,
	onToggleGroup,
	onToggleUser,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const [groupQuery, setGroupQuery] = React.useState('');
	const [userQuery, setUserQuery] = React.useState('');

	const filteredGroups = React.useMemo(
		() => filterAudienceGroups(groups, groupQuery),
		[groups, groupQuery]
	);
	const filteredUsers = React.useMemo(
		() => filterAudienceUsers(users, userQuery),
		[users, userQuery]
	);

	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<fieldset className="space-y-2">
				<legend className={DESKTOP_TYPOGRAPHY.labelOverline}>
					{t('admin.accessGroups')}
				</legend>
				<input
					type="search"
					className={INPUT_CLASS}
					placeholder={t('admin.audienceSearchGroups')}
					value={groupQuery}
					onChange={(e) => setGroupQuery(e.target.value)}
				/>
				<div className="max-h-48 space-y-1 overflow-y-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-2">
					{filteredGroups.length ? (
						filteredGroups.map((g) => (
							<label key={g.id} className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={groupIds.includes(g.id)}
									disabled={disabled}
									onChange={() => onToggleGroup(g.id)}
								/>
								{g.name}
							</label>
						))
					) : (
						<p className={DESKTOP_TYPOGRAPHY.caption}>
							{t('admin.audienceSearchEmpty')}
						</p>
					)}
				</div>
			</fieldset>
			<fieldset className="space-y-2">
				<legend className={DESKTOP_TYPOGRAPHY.labelOverline}>
					{t('admin.users')}
				</legend>
				<input
					type="search"
					className={INPUT_CLASS}
					placeholder={t('admin.audienceSearchUsers')}
					value={userQuery}
					onChange={(e) => setUserQuery(e.target.value)}
				/>
				<div className="max-h-48 space-y-1 overflow-y-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-2">
					{filteredUsers.length ? (
						filteredUsers.map((u) => (
							<label key={u.id} className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={userIds.includes(u.id)}
									disabled={disabled}
									onChange={() => onToggleUser(u.id)}
								/>
								<span>
									{u.username}
									<span className="text-(--desktop-text-dim)">
										{' '}
										· {u.email}
									</span>
								</span>
							</label>
						))
					) : (
						<p className={DESKTOP_TYPOGRAPHY.caption}>
							{t('admin.audienceSearchEmpty')}
						</p>
					)}
				</div>
			</fieldset>
		</div>
	);
}
