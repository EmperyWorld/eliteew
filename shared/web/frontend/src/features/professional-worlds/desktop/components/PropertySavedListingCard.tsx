/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Listing row/card in «Current objects» with cover preview, metadata chips, and clear selected state.
 *
 * Invariants:
 * - Grid covers load only after `registerListingCoverInterest`/`IntersectionObserver` (with root margin); `'loading'`/`'ready'`/`idle` derive from hook state passed in.
 * - Thumbnails use `ContentThumbnail` (authenticated blob) when ready with a unified id; photo count badge only after `photoTotal` is known.
 * - Entire surface is one `button` for selection (no nested interactive thumbnail).
 *
 * Related:
 * - hooks/useListingPrimaryUnifiedContentIds.ts
 * - ProfessionalWorldsApp.tsx (`savedListings`)
 */

import { CameraIcon, PhotoIcon } from '@heroicons/react/24/outline';

import { ContentThumbnail } from '@/components/UnifiedContent/components/ContentThumbnail/ContentThumbnail';

import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import { useEffect, useRef } from 'react';

import type { ListingCoverEntry } from '../hooks/useListingPrimaryUnifiedContentIds';
import { PW_MEDIA_OVERLAY_BADGE_CLASS } from '../layout/professionalWorldsLayoutTokens';
import type { RealtorProperty } from '../types';
import {
	userFacingDealTypeLabel,
	userFacingListingStatusLabel,
	userFacingPropertyTypeLabel,
} from '../userFacingContentLabels';

function toInputValue(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value);
}

export function PropertySavedListingCard({
	property,
	selected,
	onSelect,
	coverEntry,
	registerListingCoverInterest,
	listingCoverMediaRevision,
	t,
}: {
	property: RealtorProperty;
	selected: boolean;
	onSelect: () => void;
	coverEntry: ListingCoverEntry | undefined;
	registerListingCoverInterest: (propertyId: string) => void;
	/** Bump when snapshot cache for covers is invalidated (forces IO to re-trigger for in-view rows). */
	listingCoverMediaRevision: number;
	t: TFunction;
}) {
	const heroRef = useRef<HTMLDivElement | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: listingCoverMediaRevision remounts the observer after media cache clears (no scroll)
	useEffect(() => {
		const target = heroRef.current;
		if (!target) return;

		let cancelled = false;
		const observer = new IntersectionObserver(
			(entries) => {
				const first = entries[0];
				if (!first?.isIntersecting || cancelled) return;
				registerListingCoverInterest(property.id);
			},
			{
				root: null,
				rootMargin: '140px',
				threshold: 0.01,
			}
		);
		observer.observe(target);
		return () => {
			cancelled = true;
			observer.disconnect();
		};
	}, [listingCoverMediaRevision, property.id, registerListingCoverInterest]);

	const priceShown = toInputValue(property.price).trim();
	const areaShown = toInputValue(property.area_m2).trim();
	const roomsShown = property.rooms != null ? String(property.rooms) : null;

	const coverLoading = coverEntry?.kind === 'loading';
	const primaryUnifiedContentId =
		coverEntry?.kind === 'ready' ? coverEntry.primaryUnifiedContentId : null;
	const photoTotal =
		coverEntry?.kind === 'ready' ? coverEntry.photoTotal : undefined;

	return (
		<button
			type="button"
			className={cn(
				'group flex w-full flex-col overflow-hidden rounded-(--desktop-radius-lg) border text-left shadow-sm transition outline-none',
				'focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-app)',
				selected
					? 'border-[rgb(var(--desktop-accent-rgb)/0.55)] bg-(--desktop-surface-accent) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
					: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) hover:border-[rgb(var(--desktop-accent-rgb)/0.38)] hover:bg-(--desktop-surface-raised)/40'
			)}
			onClick={onSelect}
		>
			<div
				ref={heroRef}
				className="relative aspect-16/10 w-full shrink-0 overflow-hidden bg-(--desktop-surface-panel) sm:aspect-2/1"
				aria-hidden={
					!coverLoading && coverEntry === undefined && !primaryUnifiedContentId
				}
			>
				{coverLoading ? (
					<div
						role="status"
						aria-live="polite"
						className="absolute inset-0 animate-pulse bg-linear-to-br from-(--desktop-surface-soft) via-(--desktop-surface-soft-hover) to-(--desktop-border-subtle)"
					>
						<span className="sr-only">
							{t('properties.listingCardCoverLoading')}
						</span>
					</div>
				) : primaryUnifiedContentId ? (
					<ContentThumbnail
						fillParent
						alt={t('properties.listingCardPhotoAlt', { title: property.title })}
						className="size-full [&>div]:rounded-none"
						contentId={primaryUnifiedContentId}
					/>
				) : coverEntry?.kind === 'ready' ? (
					<div className="flex size-full flex-col items-center justify-center gap-1 px-3 text-center text-(--desktop-text-muted)">
						<PhotoIcon
							className="size-9 opacity-50"
							strokeWidth={1.25}
							aria-hidden
						/>
						<span className="text-[11px] leading-tight">
							{t('properties.listingCardNoPhoto')}
						</span>
					</div>
				) : (
					<div
						className="size-full bg-linear-to-br from-(--desktop-surface-soft) to-(--desktop-surface-panel)"
						aria-hidden
					/>
				)}
				{photoTotal !== undefined &&
				coverEntry?.kind === 'ready' &&
				photoTotal > 0 ? (
					<span
						className={cn(
							'absolute bottom-2 left-2 inline-flex max-w-[min(100%,8.5rem)] items-center gap-1 truncate py-0.5 text-[10px]',
							PW_MEDIA_OVERLAY_BADGE_CLASS
						)}
						title={t('properties.listingCardPhotoBadge', { count: photoTotal })}
					>
						<CameraIcon
							className="size-3.5 shrink-0 opacity-90"
							strokeWidth={1.75}
							aria-hidden
						/>
						{t('properties.listingCardPhotoBadge', { count: photoTotal })}
					</span>
				) : null}
				{priceShown ? (
					<span
						className={cn(
							'absolute right-2 top-2 max-w-[min(100%,11rem)] truncate font-semibold',
							PW_MEDIA_OVERLAY_BADGE_CLASS
						)}
					>
						{priceShown}
					</span>
				) : null}
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-3.5">
				<div className="min-w-0">
					<strong className="line-clamp-2 text-sm leading-snug text-(--desktop-text-primary) group-hover:text-[rgb(var(--desktop-accent-rgb))]">
						{property.title}
					</strong>
				</div>
				<div className="flex flex-wrap gap-1.5">
					<span className="rounded-(--desktop-radius-sm) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-secondary)">
						{userFacingDealTypeLabel(t, property.deal_type)}
					</span>
					<span className="rounded-(--desktop-radius-sm) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-secondary)">
						{userFacingPropertyTypeLabel(t, property.property_type)}
					</span>
					<span className="rounded-(--desktop-radius-sm) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-secondary)">
						{userFacingListingStatusLabel(t, property.status)}
					</span>
				</div>
				<dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-(--desktop-text-secondary) sm:grid-cols-3">
					<div className="min-w-0">
						<dt className="text-[10px] uppercase tracking-wide text-(--desktop-text-muted)">
							{t('properties.cityField')}
						</dt>
						<dd className="truncate font-medium text-(--desktop-text-primary)">
							{property.city || '—'}
							{property.district ? (
								<span className="font-normal text-(--desktop-text-muted)">
									{' · '}
									{property.district}
								</span>
							) : null}
						</dd>
					</div>
					<div>
						<dt className="text-[10px] uppercase tracking-wide text-(--desktop-text-muted)">
							{t('properties.rooms')}
						</dt>
						<dd className="font-medium text-(--desktop-text-primary)">
							{roomsShown ?? '—'}
						</dd>
					</div>
					<div className="sm:col-span-1">
						<dt className="text-[10px] uppercase tracking-wide text-(--desktop-text-muted)">
							{t('properties.area')}
						</dt>
						<dd className="font-medium tabular-nums text-(--desktop-text-primary)">
							{areaShown || '—'}
						</dd>
					</div>
				</dl>
				{selected ? (
					<div className="pt-0.5">
						<span className="inline-flex items-center rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--desktop-accent-rgb))]">
							{t('properties.listingCardSelectedBadge')}
						</span>
					</div>
				) : (
					<p className="text-[10px] text-(--desktop-text-muted)">
						{t('properties.listingCardOpenHint')}
					</p>
				)}
			</div>
		</button>
	);
}

export function ListingWorkspaceHeaderThumb({
	primaryUnifiedContentId,
	coversPending,
	title,
	t,
}: {
	primaryUnifiedContentId: string | null;
	coversPending: boolean;
	title: string;
	t: TFunction;
}) {
	return (
		<div
			className="relative size-14 shrink-0 overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) sm:size-16"
			aria-hidden
		>
			{coversPending ? (
				<div className="size-full animate-pulse bg-(--desktop-surface-soft-hover)" />
			) : primaryUnifiedContentId ? (
				<ContentThumbnail
					fillParent
					alt={t('properties.listingCardPhotoAlt', { title })}
					className="size-full"
					contentId={primaryUnifiedContentId}
				/>
			) : (
				<div className="flex size-full items-center justify-center text-(--desktop-text-muted)">
					<PhotoIcon
						className="size-6 opacity-45"
						strokeWidth={1.25}
						aria-hidden
					/>
				</div>
			)}
		</div>
	);
}
