/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Early UI for App Store detail: loading, load error (retry), and not-found
 * empty state via DesktopProductStatePanel.
 *
 * Invariants:
 * - notFound uses state="empty" (not error chrome).
 * - error retry calls fetchDetailFromApi.
 * - Back affordance remains available on error/empty paths.
 *
 * Related:
 * - AppStoreCard.tsx, useAppStoreDetailController.ts, DesktopAppChrome.tsx
 */

import { cn } from '@/utils/cn';
import { ArrowLeftIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { ReactElement } from 'react';
import { Spinner } from '@/components/ui/primitives/Spinner';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import {
	appStoreDetailLoadingBodyFrameClass,
	appStoreDetailLoadingHeroFrameClass,
} from '../../utils/appStoreCompactCardUi';
import {
	DesktopAppButton,
	DesktopAppSkeleton,
	DesktopProductStatePanel,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';

export type AppStoreDetailStateViewsProps = {
	detailShellClass: string;
	loading: boolean;
	loadError: string | null;
	hasDetail: boolean;
	onBack: () => void;
	onRetry: () => void;
	t: TFunction<'appStore'>;
};

function DetailBackButton({
	onBack,
	t,
}: {
	onBack: () => void;
	t: TFunction<'appStore'>;
}): ReactElement {
	return (
		<DesktopChromeTooltip
			content={t('detail.back')}
			placement="top"
			offsetExtra={4}
		>
			<DesktopAppButton
				type="button"
				onClick={onBack}
				variant="ghost"
				size="sm"
				className="gap-2"
				aria-label={t('detail.backAria')}
			>
				<ArrowLeftIcon
					className={DESKTOP_LUCIDE.md}
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
				{t('detail.back')}
			</DesktopAppButton>
		</DesktopChromeTooltip>
	);
}

export function AppStoreDetailStateViews({
	detailShellClass,
	loading,
	loadError,
	hasDetail,
	onBack,
	onRetry,
	t,
}: AppStoreDetailStateViewsProps): ReactElement | null {
	if (loading) {
		return (
			<div
				className="mx-auto w-full max-w-3xl"
				role="status"
				aria-busy="true"
				aria-label={t('loading.appDetail')}
			>
				<div className={cn(detailShellClass, 'overflow-hidden')}>
					<div
						className="pointer-events-none h-0.5 shrink-0 bg-linear-to-r from-[rgb(var(--desktop-accent-rgb)/0.42)] via-[rgb(var(--desktop-accent-rgb)/0.2)] to-transparent"
						aria-hidden
					/>
					<DesktopProductStatePanel
						state="loading"
						icon={<Spinner size="lg" color="blue" type="spin" />}
						title={t('loading.appDetail')}
						className="min-h-0 gap-2 border-0 px-4 py-3"
					/>
					<div className={appStoreDetailLoadingHeroFrameClass}>
						<DesktopAppSkeleton className="h-28 w-full rounded-none md:h-32" />
					</div>
					<div className="space-y-4 p-6">
						<div className={appStoreDetailLoadingBodyFrameClass}>
							<div className="flex gap-4">
								<DesktopAppSkeleton className="h-16 w-16 shrink-0 rounded-(--desktop-radius-frame)" />
								<div className="flex flex-1 flex-col gap-2 pt-2">
									<DesktopAppSkeleton className="h-6 w-2/3 max-w-xs rounded-lg" />
									<DesktopAppSkeleton className="h-4 w-1/2 max-w-[180px] rounded-md" />
								</div>
							</div>
							<div className="mt-4 grid grid-cols-2 gap-3">
								<DesktopAppSkeleton className="h-14 w-full rounded-xl" />
								<DesktopAppSkeleton className="h-14 w-full rounded-xl" />
								<DesktopAppSkeleton className="h-14 w-full rounded-xl" />
								<DesktopAppSkeleton className="h-14 w-full rounded-xl" />
							</div>
						</div>
						<DesktopAppSkeleton className="h-24 w-full rounded-xl" />
						<DesktopAppSkeleton className="ml-auto h-11 w-full max-w-xs rounded-xl" />
					</div>
				</div>
			</div>
		);
	}

	if (!hasDetail && loadError) {
		return (
			<div className="mx-auto w-full max-w-3xl space-y-4">
				<DetailBackButton onBack={onBack} t={t} />
				<DesktopProductStatePanel
					state="error"
					title={loadError}
					className={cn(
						detailShellClass,
						DESKTOP_TYPOGRAPHY.body,
						'border border-dashed border-red-400/35'
					)}
					role="alert"
					actions={
						<DesktopChromeTooltip
							content={t('retry')}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								className="gap-2"
								onClick={onRetry}
							>
								<ArrowUturnLeftIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								{t('retry')}
							</DesktopAppButton>
						</DesktopChromeTooltip>
					}
				/>
			</div>
		);
	}

	if (!hasDetail) {
		return (
			<div className="mx-auto w-full max-w-3xl space-y-4">
				<DetailBackButton onBack={onBack} t={t} />
				<DesktopProductStatePanel
					state="empty"
					title={t('detail.notFound')}
					className={cn(detailShellClass, DESKTOP_TYPOGRAPHY.body)}
				/>
			</div>
		);
	}

	return null;
}
