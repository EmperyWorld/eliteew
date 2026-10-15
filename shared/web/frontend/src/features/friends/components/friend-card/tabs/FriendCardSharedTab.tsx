/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders shared-content loading, error, empty, and result states.
 *
 * Invariants:
 * - Shared-content failures remain assertive and retryable.
 *
 * Related:
 * - ../../FriendPersonCard.tsx
 * ---
 */

import type { TFunction } from 'i18next';
import { ArrowPathIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSkeleton,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';

import type { SocialHubSharedContentItem } from '../../../api/socialHubFeedApi';

type Props = {
	t: TFunction;
	items: SocialHubSharedContentItem[];
	isLoading: boolean;
	isError: boolean;
	isFetching: boolean;
	onRefresh: () => void;
};

export function FriendCardSharedTab({
	t,
	items,
	isLoading,
	isError,
	isFetching,
	onRefresh,
}: Props): JSX.Element {
	return (
		<div>
			<div className="flex items-start justify-between gap-3">
				<div>
					<h4>{t('friends.personCardSharedTitle')}</h4>
					<p>{t('friends.personCardSharedDescription')}</p>
				</div>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={onRefresh}
					disabled={isFetching}
				>
					{isFetching ? (
						<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
					) : null}
					{t('friends.personCardSharedRefresh')}
				</DesktopAppButton>
			</div>
			{isLoading ? (
				<div
					role="status"
					aria-live="polite"
					aria-busy="true"
					aria-label={t('friends.socialHubSharedContentLoadingAria')}
					className="mt-4 space-y-3"
				>
					<DesktopAppSkeleton className="h-20 rounded-xl" />
					<DesktopAppSkeleton className="h-20 rounded-xl" />
				</div>
			) : null}
			{isError ? (
				<DesktopProductStatusBanner
					tone="danger"
					role="alert"
					aria-live="assertive"
					className="mt-4 rounded-xl"
					title={t('friends.personCardSharedLoadErrorTitle')}
					description={t('friends.personCardSharedLoadError')}
					actions={
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							onClick={onRefresh}
							disabled={isFetching}
						>
							{t('friends.personCardSharedRefresh')}
						</DesktopAppButton>
					}
				/>
			) : null}
			{!isLoading && !isError && items.length === 0 ? (
				<DesktopAppEmptyState
					className="mt-4"
					icon={
						<DocumentTextIcon
							className="h-7 w-7 text-(--desktop-text-dim)"
							aria-hidden
						/>
					}
					title={t('friends.personCardSharedEmptyTitle')}
					description={t('friends.personCardSharedEmptyDescription')}
				/>
			) : null}
			{!isLoading && !isError ? (
				<div className="mt-4 space-y-3">
					{items.map((item) => (
						<div key={item.id} className="rounded-xl border p-3">
							<div className="font-medium">
								{item.title?.trim() || item.name?.trim() || item.id}
							</div>
							<div className="text-xs">
								{item.content_type} · {item.direction}
							</div>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
