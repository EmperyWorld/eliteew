/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared audio track metadata block (thumbnail + title + optional error/retry and custom details).
 *
 * Invariants:
 * - Thumbnail always uses authenticated ContentThumbnail fallback.
 * - Error retry CTA is optional and renders only when both error and callback are provided.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerNowPlayingBar.tsx
 * - src/pages/Desktop/components/DesktopWorkspaceFloatingWidget.tsx
 * - DesktopChromeTooltip.tsx (desktop-styled title tooltips)
 */

import * as React from 'react';
import { MusicalNoteIcon } from '@heroicons/react/24/outline';

import { cn } from '@/utils/cn';
import { ContentThumbnail } from '@/components/UnifiedContent/components/ContentThumbnail';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';

export type AudioTrackMetaTitleTooltip = 'native' | 'desktop-styled';

interface AudioTrackMetaProps {
	contentId: string;
	title: string;
	titleLabel?: string;
	error?: string | null;
	onRetryError?: (() => void) | null;
	retryLabel?: string;
	className?: string;
	thumbnailClassName?: string;
	thumbnailFallbackIconClassName?: string;
	titleLabelClassName?: string;
	titleClassName?: string;
	textBlockClassName?: string;
	errorClassName?: string;
	retryButtonClassName?: string;
	children?: React.ReactNode;
	/** Native browser title vs Visual Studio styled tooltip on the track name. */
	titleTooltip?: AudioTrackMetaTitleTooltip;
}

export function AudioTrackMeta({
	contentId,
	title,
	titleLabel,
	error = null,
	onRetryError = null,
	retryLabel = 'Повторить',
	className,
	thumbnailClassName,
	thumbnailFallbackIconClassName,
	titleLabelClassName,
	titleClassName,
	textBlockClassName,
	errorClassName,
	retryButtonClassName,
	children,
	titleTooltip = 'native',
}: AudioTrackMetaProps): React.JSX.Element {
	const titleHeading = (
		<h2
			className={titleClassName}
			title={titleTooltip === 'native' ? title : undefined}
		>
			{title}
		</h2>
	);

	return (
		<div
			className={cn(
				'flex w-full min-w-0 flex-1 items-start gap-2.5',
				className
			)}
		>
			<div
				className={cn(
					'h-10 w-10 shrink-0 overflow-hidden rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) shadow-(--desktop-shadow-soft)',
					thumbnailClassName
				)}
			>
				<ContentThumbnail
					contentId={contentId}
					className="h-full w-full object-cover"
					skipThumbnail
				>
					<div className="flex h-full w-full items-center justify-center">
						<MusicalNoteIcon
							className={cn(
								'h-5 w-5 text-(--desktop-text-dim)',
								thumbnailFallbackIconClassName
							)}
						/>
					</div>
				</ContentThumbnail>
			</div>
			<div className={cn('min-h-0 min-w-0 w-full flex-1', textBlockClassName)}>
				{titleLabel ? (
					<p
						className={cn(
							'text-[10px] font-medium tracking-normal text-(--desktop-text-dim)',
							titleLabelClassName
						)}
					>
						{titleLabel}
					</p>
				) : null}
				{titleTooltip === 'desktop-styled' ? (
					<DesktopChromeTooltip content={title} placement="top" offsetExtra={4}>
						{titleHeading}
					</DesktopChromeTooltip>
				) : (
					titleHeading
				)}
				{error ? (
					<div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
						<p className={cn('min-w-0 max-w-full flex-1', errorClassName)}>
							{error}
						</p>
						{onRetryError ? (
							<button
								type="button"
								className={cn(
									'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-app)',
									retryButtonClassName
								)}
								onClick={onRetryError}
							>
								{retryLabel}
							</button>
						) : null}
					</div>
				) : null}
				{children}
			</div>
		</div>
	);
}
