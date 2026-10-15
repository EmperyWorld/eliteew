/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render Friends Directory navigation context and overview metrics.
 * This is presentational; data refresh stays owned by the directory orchestrator.
 *
 * Invariants:
 * - Anchor IDs are derived from the parent-provided prefix.
 * - IA strip has no cyan radial wash; metrics stay sentence-case via directory tokens.
 *
 * Related:
 * - ../FriendsDirectory.tsx
 */

import { useTranslation } from 'react-i18next';

import {
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';

import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppPanel,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import {
	type DirectorySmartFilter,
	useFriendsDirectoryFilters,
} from '../../hooks/useFriendsDirectoryFilters';
import type { FriendsStats } from '../../types';
import { FriendsInfoButton } from '../FriendsInfoButton';

interface FriendsDirectoryOverviewStripProps {
	anchorPrefix: string;
	initialSection: 'friends' | 'circles';
	shellInset: string;
	shellPanel: string;
	stats: FriendsStats;
}

export function FriendsDirectoryOverviewStrip({
	anchorPrefix,
	initialSection,
	shellInset,
	shellPanel,
	stats,
}: FriendsDirectoryOverviewStripProps): JSX.Element {
	const { t } = useTranslation('contentManager');
	const cards = [
		{
			color: 'cyan',
			count: stats.friendsCount,
			description: t('friends.summaryFriendsDescription'),
			icon: <UsersIcon className="h-4 w-4 text-cyan-400" aria-hidden />,
			label: t('friends.listTitle'),
		},
		{
			color: 'emerald',
			count: stats.incomingRequestsCount,
			description: t('friends.summaryIncomingDescription'),
			icon: (
				<ArrowDownTrayIcon className="h-4 w-4 text-emerald-400" aria-hidden />
			),
			label: t('friends.incomingTitle'),
		},
		{
			color: 'violet',
			count: stats.sentRequestsCount,
			description: t('friends.summarySentDescription'),
			icon: <ArrowUpTrayIcon className="h-4 w-4 text-violet-400" aria-hidden />,
			label: t('friends.sentTitle'),
		},
	];

	return (
		<>
			<DesktopAppPanel className="relative overflow-hidden p-4">
				<span
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]"
				/>
				<div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<div className="text-sm font-semibold text-(--desktop-text-primary)">
							{initialSection === 'circles'
								? t('friends.directoryIaCirclesTitle')
								: t('friends.directoryIaFriendsTitle')}
						</div>
						<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-muted)">
							{initialSection === 'circles'
								? t('friends.directoryIaCirclesHint')
								: t('friends.directoryIaFriendsHint')}
						</p>
					</div>
					<nav
						className="flex flex-wrap gap-1.5"
						aria-label={t('friends.overviewTitle')}
					>
						{['search', 'requests', 'friends', 'circles', 'detail'].map(
							(id) => (
								<a
									key={id}
									href={`#${anchorPrefix}-${id}`}
									className={cn(
										shellInset,
										'rounded-md px-3 py-1.5 text-xs font-medium tracking-normal text-(--desktop-text-muted) hover:text-(--desktop-text-primary)',
										initialSection === id
											? 'border-[rgb(var(--desktop-accent-rgb))]/30 bg-[rgb(var(--desktop-accent-rgb))]/10 text-(--desktop-text-primary)'
											: ''
									)}
								>
									{t(`friends.directoryIa${id[0].toUpperCase()}${id.slice(1)}`)}
								</a>
							)
						)}
					</nav>
				</div>
			</DesktopAppPanel>
			<div className={cn('min-h-0', shellPanel, 'p-5')}>
				<div className="mb-4 flex items-start justify-between gap-3">
					<div>
						<h3 className="text-sm font-medium text-slate-300">
							{t('friends.overviewTitle')}
						</h3>
						<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-muted)">
							{t('friends.overviewHint')}
						</p>
					</div>
					<FriendsInfoButton
						title={t('friends.overviewTitle')}
						description={t('friends.helpOverview')}
					/>
				</div>
				<div className="grid gap-3 md:grid-cols-3">
					{cards.map((card) => (
						<div
							key={card.label}
							className={cn(
								shellInset,
								`rounded-2xl p-4 transition-colors hover:border-${card.color}-400/30`
							)}
						>
							<div className="flex items-center gap-2 text-sm font-medium text-(--desktop-text-secondary)">
								{card.icon}
								{card.label}
							</div>
							<div className="mt-3 text-3xl font-semibold tracking-tight text-(--desktop-text-primary)">
								{card.count}
							</div>
							<p className="mt-2 text-xs leading-relaxed text-(--desktop-text-muted)">
								{card.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</>
	);
}

export function FriendsDirectoryFilters({
	filters,
	shellField,
}: {
	filters: ReturnType<typeof useFriendsDirectoryFilters>;
	shellField: string;
}): JSX.Element {
	const { t } = useTranslation('contentManager');
	return (
		<>
			<input
				type="search"
				value={filters.directoryListFilter}
				onChange={(event) => filters.setDirectoryListFilter(event.target.value)}
				placeholder={t('friends.directoryFilterPlaceholder')}
				className={cn(
					shellField,
					'min-h-11 min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm text-(--desktop-text-primary)'
				)}
				aria-label={t('friends.directoryFilterLabel')}
			/>
			<DesktopNativeSelect
				value={filters.directorySmartFilter}
				onChange={(event) =>
					filters.setDirectorySmartFilter(
						event.target.value as DirectorySmartFilter
					)
				}
				className="min-h-11 text-sm"
				aria-label={t('friends.directorySmartFilterLabel')}
			>
				{(['all', 'favorites', 'limited', 'recent', 'quiet'] as const).map(
					(value) => (
						<option
							key={value}
							value={value}
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t(`friends.directorySmartFilter.${value}`)}
						</option>
					)
				)}
			</DesktopNativeSelect>
			<DesktopNativeSelect
				value={filters.directorySortMode}
				onChange={(event) =>
					filters.setDirectorySortMode(
						event.target.value === 'recent' ? 'recent' : 'name'
					)
				}
				className="min-h-11 text-sm"
				aria-label={t('friends.directorySortLabel')}
			>
				<option value="name" className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}>
					{t('friends.directorySortName')}
				</option>
				<option
					value="recent"
					className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
				>
					{t('friends.directorySortRecent')}
				</option>
			</DesktopNativeSelect>
		</>
	);
}
