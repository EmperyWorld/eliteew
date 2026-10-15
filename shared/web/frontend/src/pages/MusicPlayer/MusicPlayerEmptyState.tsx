/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Polished empty-state panel for Music Player library, folder and filtered views with actionable CTAs.
 *
 * Invariants:
 * - Copy and variant semantics come from `musicPlayerEmptyState` helpers.
 * - Primary CTAs open desktop apps without stealing keyboard focus from the page root.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/MusicPlayer/musicPlayerEmptyState.ts
 */

import { cn } from '@/lib/utils';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowUpTrayIcon,
	MusicalNoteIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import { DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import {
	musicPlayerEmptyStateDescriptionKey,
	musicPlayerEmptyStateShowsLibraryCtas,
	musicPlayerEmptyStateTitleKey,
	type MusicPlayerEmptyStateKind,
} from './musicPlayerEmptyState';

const primaryCtaClass = cn(
	'rounded-(--desktop-radius-lg) px-5 py-2.5 text-sm font-medium text-white transition',
	'bg-[rgb(var(--desktop-accent-rgb))] hover:brightness-110 active:brightness-95',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-inset'
);

const secondaryCtaClass = cn(
	'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) px-4 py-2.5 text-sm font-medium text-(--desktop-text-secondary) transition',
	'hover:border-[rgb(var(--desktop-accent-rgb)/0.28)] hover:bg-(--desktop-surface-soft-hover)',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)] focus-visible:ring-inset'
);

const filterResetBtnClass = cn(
	'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) px-4 py-2 text-xs font-medium text-(--desktop-text-secondary) transition',
	'hover:border-[rgb(var(--desktop-accent-rgb)/0.28)] hover:bg-(--desktop-surface-soft-hover)',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)] focus-visible:ring-inset'
);

type MusicPlayerEmptyStateProps = {
	kind: MusicPlayerEmptyStateKind;
	contentPanelClass: string;
	strokeWidth: number;
	showFilterResetActions: boolean;
	hasSearchQuery: boolean;
	hasActiveTag: boolean;
	hasPlaylistSelection: boolean;
	hasOriginFilter: boolean;
	onClearSearch: () => void;
	onClearActiveTag: () => void;
	onClearPlaylistSelection: () => void;
	onClearOriginFilter: () => void;
	onShowAllMusic: () => void;
	onOpenMusicGenerator: () => void;
	onOpenContentManager: () => void;
};

export const MusicPlayerEmptyState = memo(function MusicPlayerEmptyState({
	kind,
	contentPanelClass,
	strokeWidth,
	showFilterResetActions,
	hasSearchQuery,
	hasActiveTag,
	hasPlaylistSelection,
	hasOriginFilter,
	onClearSearch,
	onClearActiveTag,
	onClearPlaylistSelection,
	onClearOriginFilter,
	onShowAllMusic,
	onOpenMusicGenerator,
	onOpenContentManager,
}: MusicPlayerEmptyStateProps) {
	const { t } = useTranslation('desktopUi');
	const showLibraryCtas = musicPlayerEmptyStateShowsLibraryCtas(kind);
	const canPulseGenerateCta = showLibraryCtas;

	return (
		<div
			className="flex min-h-48 items-center justify-center px-4 py-12 text-(--desktop-text-secondary)"
			role="status"
		>
			<div
				className={cn(
					'grid w-full max-w-4xl gap-6',
					showLibraryCtas
						? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]'
						: ''
				)}
			>
				<div className="flex flex-col items-center lg:items-start">
					<div
						className={cn(
							contentPanelClass,
							'mb-5 flex h-18 w-18 items-center justify-center p-0'
						)}
					>
						<MusicalNoteIcon
							className="h-9 w-9 text-(--desktop-text-dim)"
							strokeWidth={strokeWidth}
						/>
					</div>
					<p className="mb-1 max-w-lg text-center text-sm font-semibold text-(--desktop-text-primary) lg:text-left">
						{t(musicPlayerEmptyStateTitleKey(kind))}
					</p>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'max-w-lg text-center text-(--desktop-text-muted) lg:text-left'
						)}
					>
						{t(musicPlayerEmptyStateDescriptionKey(kind))}
					</p>

					{kind === 'music-folder-empty' ? (
						<div className="mt-5 grid w-full gap-2 sm:grid-cols-2">
							<div className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2.5 text-left">
								<p className="text-[11px] font-semibold text-(--desktop-text-primary)">
									{t(
										'musicPlayer.emptyState.musicFolderEmpty.musicFolderCardTitle'
									)}
								</p>
								<p className="mt-1 text-[10px] leading-relaxed text-(--desktop-text-muted)">
									{t(
										'musicPlayer.emptyState.musicFolderEmpty.musicFolderCardBody'
									)}
								</p>
							</div>
							<div className="rounded-(--desktop-radius-lg) border border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] px-3 py-2.5 text-left">
								<p className="text-[11px] font-semibold text-(--desktop-text-primary)">
									{t(
										'musicPlayer.emptyState.musicFolderEmpty.allMusicCardTitle'
									)}
								</p>
								<p className="mt-1 text-[10px] leading-relaxed text-(--desktop-text-muted)">
									{t(
										'musicPlayer.emptyState.musicFolderEmpty.allMusicCardBody'
									)}
								</p>
							</div>
						</div>
					) : null}

					{kind === 'music-folder-empty' ? (
						<button
							type="button"
							onClick={onShowAllMusic}
							className={cn(secondaryCtaClass, 'mt-4 w-full sm:w-auto')}
						>
							{t('musicPlayer.emptyState.musicFolderEmpty.showAllMusic')}
						</button>
					) : null}

					{showFilterResetActions ? (
						<div className="mt-6 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
							{hasSearchQuery ? (
								<button
									type="button"
									onClick={onClearSearch}
									className={filterResetBtnClass}
								>
									{t('musicPlayer.emptyState.clearSearch')}
								</button>
							) : null}
							{hasActiveTag ? (
								<button
									type="button"
									onClick={onClearActiveTag}
									className={filterResetBtnClass}
								>
									{t('musicPlayer.emptyState.clearTag')}
								</button>
							) : null}
							{hasOriginFilter ? (
								<button
									type="button"
									onClick={onClearOriginFilter}
									className={filterResetBtnClass}
								>
									{t('musicPlayer.emptyState.clearOrigin')}
								</button>
							) : null}
							{hasPlaylistSelection ? (
								<button
									type="button"
									onClick={onClearPlaylistSelection}
									className={filterResetBtnClass}
								>
									{t('musicPlayer.emptyState.clearPlaylist')}
								</button>
							) : null}
						</div>
					) : null}

					{showLibraryCtas && kind === 'library-empty' ? (
						<p className="mt-4 max-w-md text-center text-[10px] text-(--desktop-text-dim) lg:text-left">
							{t('musicPlayer.emptyState.libraryEmpty.hint')}
						</p>
					) : null}
				</div>

				{showLibraryCtas ? (
					<div className="flex flex-col justify-center rounded-(--desktop-radius-xl) border border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-[rgb(var(--desktop-accent-rgb)/0.06)] p-4 sm:p-5 lg:sticky lg:top-4">
						<p className="mb-3 text-[10px] font-medium tracking-normal text-(--desktop-text-dim)">
							{t('musicPlayer.emptyState.quickStart')}
						</p>
						<button
							type="button"
							onClick={onOpenMusicGenerator}
							className={cn(
								primaryCtaClass,
								'inline-flex w-full items-center justify-center gap-2',
								canPulseGenerateCta &&
									'motion-reduce:animate-none animate-pulse shadow-[0_0_22px_rgb(var(--desktop-accent-rgb)/0.35)] ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.35)]'
							)}
						>
							<SparklesIcon
								className="h-4 w-4 shrink-0"
								strokeWidth={strokeWidth}
							/>
							{t('musicPlayer.emptyState.generateMusic')}
						</button>
						<button
							type="button"
							onClick={onOpenContentManager}
							className={cn(
								secondaryCtaClass,
								'mt-2 inline-flex w-full items-center justify-center gap-2'
							)}
						>
							<ArrowUpTrayIcon
								className="h-4 w-4 shrink-0"
								strokeWidth={strokeWidth}
							/>
							{t('musicPlayer.emptyState.uploadContentManager')}
						</button>
					</div>
				) : null}
			</div>
		</div>
	);
});
