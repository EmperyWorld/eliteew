/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sidebar for Kursorina: mission history list, search filter, new task action.
 *
 * Invariants:
 * - Desktop typography and focus styling compliance.
 * - Non-destructive delete action with explicit click.
 *
 * Related:
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/types.ts
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/kursorinaUtils.ts
 */

import { useState, type ReactElement } from 'react';
import {
	ArrowPathIcon,
	CheckCircleIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	TrashIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	extractTopicFromGoal,
	formatRelativeDate,
	statusLabel,
} from './kursorinaUtils';
import type { MissionPublicView, MissionStatus } from './types';

interface KursorinaSidebarProps {
	missions: MissionPublicView[];
	selectedId: string | null;
	isComposing: boolean;
	loading: boolean;
	onSelectMission: (id: string) => void;
	onNewMission: () => void;
	onDeleteMission: (id: string) => void;
	onRefresh: () => void;
}

function StatusGlyph({ status }: { status: MissionStatus }): ReactElement {
	switch (status) {
		case 'queued':
			return (
				<ClockIcon
					className="h-4 w-4 shrink-0 text-amber-400"
					title={statusLabel(status)}
				/>
			);
		case 'running':
			return (
				<ArrowPathIcon
					className="h-4 w-4 shrink-0 motion-safe:animate-spin text-sky-400"
					title={statusLabel(status)}
				/>
			);
		case 'completed':
			return (
				<CheckCircleIcon
					className="h-4 w-4 shrink-0 text-emerald-400"
					title={statusLabel(status)}
				/>
			);
		case 'blocked':
			return (
				<ExclamationTriangleIcon
					className="h-4 w-4 shrink-0 text-amber-400"
					title={statusLabel(status)}
				/>
			);
		case 'cancelled':
			return (
				<XCircleIcon
					className="h-4 w-4 shrink-0 text-zinc-500"
					title={statusLabel(status)}
				/>
			);
		default:
			return <span className="h-2 w-2 rounded-full bg-zinc-500" />;
	}
}

export function KursorinaSidebar({
	missions,
	selectedId,
	isComposing,
	loading,
	onSelectMission,
	onNewMission,
	onDeleteMission,
	onRefresh,
}: KursorinaSidebarProps): ReactElement {
	const [searchQuery, setSearchQuery] = useState('');

	const filtered = missions.filter((m) => {
		if (!searchQuery.trim()) return true;
		const q = searchQuery.toLowerCase();
		return (
			m.goal.toLowerCase().includes(q) || m.answer?.toLowerCase().includes(q)
		);
	});

	return (
		<aside className="flex h-full w-80 shrink-0 flex-col border-r border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,var(--desktop-surface-panel)_45%)] xl:w-[22rem]">
			{/* Sidebar Header & New Investigation Button */}
			<div className="flex flex-col gap-2.5 border-b border-(--desktop-border-subtle) p-3.5">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
							Расследования
						</span>
						<span className="rounded-full bg-(--desktop-surface-soft) px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-(--desktop-text-secondary)">
							{missions.length}
						</span>
					</div>
					<button
						type="button"
						onClick={onRefresh}
						disabled={loading}
						className="rounded p-1 text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary) transition-colors"
						title="Обновить список"
						aria-label="Обновить список"
					>
						<ArrowPathIcon
							className={cn(
								'h-3.5 w-3.5',
								loading && 'motion-safe:animate-spin'
							)}
						/>
					</button>
				</div>

				<DesktopAppButton
					type="button"
					variant="accent"
					size="sm"
					onClick={onNewMission}
					className="w-full justify-center gap-1.5 font-medium shadow-sm"
				>
					<PlusIcon className="h-4 w-4" />
					<span>Новая цель</span>
				</DesktopAppButton>

				{/* Quick Filter */}
				{missions.length > 3 ? (
					<div className="relative mt-1">
						<MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--desktop-text-dim)" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Поиск по истории…"
							className="h-7 w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) pl-8 pr-2 text-xs text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none focus:border-[rgb(var(--desktop-accent-rgb))]/60"
						/>
					</div>
				) : null}
			</div>

			{/* Mission Items List */}
			<div className="flex-1 overflow-y-auto p-2 space-y-1">
				{filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-6 text-center">
						<p className="text-xs text-(--desktop-text-muted)">
							{searchQuery
								? 'Ничего не найдено'
								: 'История расследований пуста. Начните свое первое расследование!'}
						</p>
					</div>
				) : (
					filtered.map((item) => {
						const isSelected = !isComposing && selectedId === item.id;
						const topic = extractTopicFromGoal(item.goal);
						const dateStr = formatRelativeDate(
							item.updated_at || item.created_at
						);
						const resultsCount = item.results?.length ?? 0;

						return (
							<button
								key={item.id}
								type="button"
								className={cn(
									'group relative flex w-full cursor-pointer flex-col gap-1 rounded-(--desktop-radius) border p-2.5 text-left transition-all duration-150',
									isSelected
										? 'border-[rgb(var(--desktop-accent-rgb))]/50 bg-[rgb(var(--desktop-accent-rgb))]/10 text-(--desktop-text-primary) shadow-sm'
										: 'border-transparent hover:border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft)/70 text-(--desktop-text-secondary)'
								)}
								onClick={() => onSelectMission(item.id)}
							>
								<div className="flex items-start justify-between gap-2">
									<div className="flex items-center gap-1.5 overflow-hidden">
										<StatusGlyph status={item.status} />
										<span
											className={cn(
												'truncate text-xs font-medium',
												isSelected
													? 'text-(--desktop-text-primary)'
													: 'text-(--desktop-text-secondary)'
											)}
										>
											{topic}
										</span>
									</div>

									{/* Delete Button on Hover */}
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onDeleteMission(item.id);
										}}
										className="opacity-0 group-hover:opacity-100 p-0.5 text-(--desktop-text-muted) hover:text-rose-400 transition-opacity"
										title="Удалить из истории"
										aria-label="Удалить из истории"
									>
										<TrashIcon className="h-3.5 w-3.5" />
									</button>
								</div>

								<div className="flex items-center justify-between text-[11px] text-(--desktop-text-muted)">
									<span>{dateStr}</span>
									<div className="flex items-center gap-1">
										{resultsCount > 0 ? (
											<span className="rounded bg-(--desktop-surface-soft) px-1.5 py-0.2 text-[10px]">
												{resultsCount}{' '}
												{resultsCount === 1 ? 'источник' : 'источников'}
											</span>
										) : null}
										<span className="text-[10px] opacity-80">
											{statusLabel(item.status)}
										</span>
									</div>
								</div>
							</button>
						);
					})
				)}
			</div>
		</aside>
	);
}
