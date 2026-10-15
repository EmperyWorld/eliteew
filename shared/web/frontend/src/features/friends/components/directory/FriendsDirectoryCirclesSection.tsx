/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render circle creation, selection, naming, and bulk-assignment controls.
 * Mutation ownership remains in the Friends Directory action layer.
 *
 * Invariants:
 * - Bulk assignment is unavailable without both a selected circle and selected friends.
 *
 * Related:
 * - ../FriendsDirectory.tsx
 * - ../../hooks/useFriendsDirectoryFilters.ts
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	ArrowPathIcon,
	PencilSquareIcon,
	TrashIcon,
	UserPlusIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import type { Friend, FriendCircle } from '../../types';
import { FriendsInfoButton } from '../FriendsInfoButton';

interface FriendsDirectoryCirclesSectionProps {
	anchorPrefix: string;
	bulkSelectedCount: number;
	circles: FriendCircle[];
	friends: Friend[];
	onAssignBulk: () => void;
	onClearBulk: () => void;
	onCreateCircle: (name: string, afterSuccess: () => void) => void;
	onDeleteCircle: () => void;
	onRenameCircle: (name: string) => void;
	onSelectCircle: (circleId: string | null) => void;
	onSelectVisible: () => void;
	selectedCircle: FriendCircle | null;
	selectedCircleId: string | null;
	shellField: string;
	shellInset: string;
	shellPanel: string;
	visibleFriendsCount: number;
	isCreating: boolean;
	isDeleting: boolean;
	isRenaming: boolean;
	isSavingRelationship: boolean;
}

export function FriendsDirectoryCirclesSection({
	anchorPrefix,
	bulkSelectedCount,
	circles,
	friends,
	isCreating,
	isDeleting,
	isRenaming,
	isSavingRelationship,
	onAssignBulk,
	onClearBulk,
	onCreateCircle,
	onDeleteCircle,
	onRenameCircle,
	onSelectCircle,
	onSelectVisible,
	selectedCircle,
	selectedCircleId,
	shellField,
	shellInset,
	shellPanel,
	visibleFriendsCount,
}: FriendsDirectoryCirclesSectionProps): JSX.Element {
	const { t } = useTranslation('contentManager');
	const [newName, setNewName] = useState('');
	const [renameName, setRenameName] = useState('');
	useEffect(
		() => setRenameName(selectedCircle?.name ?? ''),
		[selectedCircle?.name]
	);

	return (
		<div
			id={`${anchorPrefix}-circles`}
			className={cn('min-h-0', shellPanel, 'p-5')}
		>
			<div className="mb-4 flex items-start justify-between gap-3">
				<div>
					<h3 className="flex items-center gap-2 text-sm font-medium text-slate-300">
						<UsersIcon className="h-4 w-4 text-cyan-400" aria-hidden />
						{t('friends.circlesTitle')}
					</h3>
					<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-muted)">
						{t('friends.circlesHint')}
					</p>
				</div>
				<FriendsInfoButton
					title={t('friends.circlesTitle')}
					description={t('friends.helpLists')}
				/>
			</div>
			<div className="mb-4 grid gap-2 sm:grid-cols-3">
				{[
					[t('friends.circleMetricLists'), circles.length],
					[
						t('friends.circleMetricShown'),
						selectedCircle?.members_count ?? friends.length,
					],
					[t('friends.circleMetricBulk'), bulkSelectedCount],
				].map(([label, count]) => (
					<div
						key={String(label)}
						className={cn(shellInset, 'rounded-2xl px-3 py-2.5')}
					>
						<div className={DESKTOP_TYPOGRAPHY.meta}>{label}</div>
						<div className="mt-1 text-lg font-semibold tabular-nums text-(--desktop-text-primary)">
							{count}
						</div>
					</div>
				))}
			</div>
			<div className="flex flex-wrap gap-2">
				<input
					value={newName}
					onChange={(event) => setNewName(event.target.value)}
					placeholder={t('friends.circleInputPlaceholder')}
					className={cn(
						shellField,
						'min-w-[180px] flex-1 rounded-xl px-3 py-2 text-sm text-(--desktop-text-primary)'
					)}
					aria-label={t('friends.circleInputPlaceholder')}
				/>
				<DesktopAppButton
					type="button"
					variant="accent"
					onClick={() => onCreateCircle(newName, () => setNewName(''))}
					disabled={!newName.trim() || isCreating}
				>
					{isCreating ? (
						<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
					) : (
						<UserPlusIcon className="h-4 w-4" aria-hidden />
					)}
					{t('friends.circleCreateButton')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="neutral"
					onClick={onDeleteCircle}
					disabled={!selectedCircleId || isDeleting}
				>
					{isDeleting ? (
						<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
					) : (
						<TrashIcon className="h-4 w-4" aria-hidden />
					)}
					{t('friends.circleDeleteButton')}
				</DesktopAppButton>
			</div>
			{selectedCircle ? (
				<div className="mt-4 space-y-3 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
					<div>
						{t('friends.circleSelectedFilter', { name: selectedCircle.name })}
					</div>
					<div className="flex gap-2">
						<input
							value={renameName}
							onChange={(event) => setRenameName(event.target.value)}
							className={cn(
								shellField,
								'min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-(--desktop-text-primary)'
							)}
							aria-label={t('friends.circleRenamePlaceholder')}
						/>
						<DesktopAppButton
							type="button"
							variant="neutral"
							onClick={() => onRenameCircle(renameName)}
							disabled={
								!renameName.trim() ||
								renameName.trim() === selectedCircle.name ||
								isRenaming
							}
						>
							{isRenaming ? (
								<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
							) : (
								<PencilSquareIcon className="h-4 w-4" aria-hidden />
							)}
							{t('friends.circleRenameButton')}
						</DesktopAppButton>
					</div>
				</div>
			) : null}
			<div className={cn(shellInset, 'mt-4 rounded-2xl p-3')}>
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<div className="text-sm font-semibold text-(--desktop-text-primary)">
							{t('friends.circleBulkTitle')}
						</div>
						<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-muted)">
							{t('friends.circleBulkHint', { count: bulkSelectedCount })}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							onClick={onSelectVisible}
							disabled={!visibleFriendsCount}
						>
							{t('friends.circleBulkSelectVisible')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							onClick={onClearBulk}
							disabled={!bulkSelectedCount}
						>
							{t('friends.circleBulkClear')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							onClick={onAssignBulk}
							disabled={
								!selectedCircle || !bulkSelectedCount || isSavingRelationship
							}
						>
							{t('friends.circleBulkAssign')}
						</DesktopAppButton>
					</div>
				</div>
			</div>
			<div className="mt-4 grid gap-3 sm:grid-cols-2">
				{[
					{
						id: null,
						name: t('friends.circleAllFilter'),
						members_count: friends.length,
					},
					...circles,
				].map((circle) => {
					const selected = selectedCircleId === circle.id;
					return (
						<button
							key={circle.id ?? 'all'}
							type="button"
							onClick={() => onSelectCircle(circle.id)}
							className={cn(
								'rounded-2xl p-4 text-left motion-safe:transition',
								selected
									? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-50'
									: cn(shellInset, 'hover:border-cyan-500/30')
							)}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="text-sm font-semibold">{circle.name}</div>
								<span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
									{circle.members_count}
								</span>
							</div>
							<div className="mt-2 text-xs text-(--desktop-text-muted)">
								{t('friends.circleMembersCountLabel', {
									count: circle.members_count,
								})}
							</div>
						</button>
					);
				})}
			</div>
			{!circles.length ? (
				<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-3')}>
					{t('friends.circlesEmpty')}
				</p>
			) : null}
		</div>
	);
}
