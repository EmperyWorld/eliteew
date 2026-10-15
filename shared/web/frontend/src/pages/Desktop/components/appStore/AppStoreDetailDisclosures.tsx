/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App Store detail progressive disclosure — billing and technical `<details>`
 * panels (inset collapsible bodies).
 *
 * Invariants:
 * - Billing-only panel when !showTechnicalDetails && !billingExempt.
 * - Technical panel when showTechnicalDetails; embeds billing rows unless exempt.
 *
 * Related:
 * - AppStoreDetailBody.tsx, useAppStoreDetailController.ts
 */

import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import type { ReactElement } from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type {
	StoreAppDetailResponse,
	StoreAppResponse,
} from '../../services/desktopApi';
import {
	appStoreDetailCollapsibleBodyClass,
	appStoreDetailCollapsiblePanelClass,
	appStoreDetailCollapsibleSummaryClass,
} from '../../utils/appStoreCompactCardUi';

export type AppStoreDetailDisclosuresProps = {
	detail: StoreAppDetailResponse | StoreAppResponse;
	t: TFunction<'appStore'>;
	showTechnicalDetails: boolean;
	billingExempt: boolean;
	ewPrice: number;
	trialDays: number;
};

export function AppStoreDetailDisclosures({
	detail,
	t,
	showTechnicalDetails,
	billingExempt,
	ewPrice,
	trialDays,
}: AppStoreDetailDisclosuresProps): ReactElement | null {
	const billingOnly = !showTechnicalDetails && !billingExempt;
	if (!billingOnly && !showTechnicalDetails) {
		return null;
	}

	return (
		<>
			{billingOnly ? (
				<details className={appStoreDetailCollapsiblePanelClass}>
					<summary className={appStoreDetailCollapsibleSummaryClass}>
						<span>{t('detail.billingSummary')}</span>
						<span className={DESKTOP_TYPOGRAPHY.meta}>
							{t('detail.billingHint')}
						</span>
					</summary>
					<div
						className={cn(
							appStoreDetailCollapsibleBodyClass,
							'flex flex-wrap gap-6'
						)}
					>
						<div>
							<p className="text-(--desktop-text-secondary)">
								{t('detail.ewMonthly')}
							</p>
							<p className="font-medium text-(--desktop-text-primary)">
								{ewPrice} EW
							</p>
						</div>
						<div>
							<p className="text-(--desktop-text-secondary)">
								{t('detail.trial')}
							</p>
							<p className="font-medium text-(--desktop-text-primary)">
								{trialDays > 0
									? t('detail.trialDaysValue', { count: trialDays })
									: '—'}
							</p>
						</div>
					</div>
				</details>
			) : null}

			{showTechnicalDetails ? (
				<details className={appStoreDetailCollapsiblePanelClass}>
					<summary className={appStoreDetailCollapsibleSummaryClass}>
						<span>{t('detail.technicalSummary')}</span>
						<span className={DESKTOP_TYPOGRAPHY.meta}>
							{t('detail.technicalHint')}
						</span>
					</summary>
					<div className={appStoreDetailCollapsibleBodyClass}>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className={DESKTOP_TYPOGRAPHY.body}>
									{t('detail.component')}
								</p>
								<p className="font-medium text-(--desktop-text-primary)">
									{detail.app_component}
								</p>
							</div>
							<div>
								<p className={DESKTOP_TYPOGRAPHY.body}>
									{t('detail.sortOrder')}
								</p>
								<p className="font-medium text-(--desktop-text-primary)">
									{detail.sort_order}
								</p>
							</div>
							<div className="col-span-2 sm:col-span-1">
								<p className={DESKTOP_TYPOGRAPHY.body}>{t('detail.id')}</p>
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.body,
										'break-all font-mono font-medium text-(--desktop-text-primary)'
									)}
								>
									{detail.app_id}
								</p>
							</div>
							<div className="col-span-2 sm:col-span-1">
								<p className={DESKTOP_TYPOGRAPHY.body}>
									{t('detail.accessGroup')}
								</p>
								<p className="font-medium text-(--desktop-text-primary)">
									{(detail.access_groups?.length ?? 0) > 0
										? detail.access_groups
												?.map((g) => g.name)
												.sort()
												.join(', ')
										: '—'}
								</p>
							</div>
							{!billingExempt ? (
								<>
									<div>
										<p className={DESKTOP_TYPOGRAPHY.body}>
											{t('detail.ewMonthly')}
										</p>
										<p className="font-medium text-(--desktop-text-primary)">
											{ewPrice} EW
										</p>
									</div>
									<div>
										<p className={DESKTOP_TYPOGRAPHY.body}>
											{t('detail.trial')}
										</p>
										<p className="font-medium text-(--desktop-text-primary)">
											{trialDays > 0
												? t('detail.trialDaysValue', { count: trialDays })
												: '—'}
										</p>
									</div>
								</>
							) : null}
							<div className="col-span-2">
								<p className={DESKTOP_TYPOGRAPHY.body}>{t('detail.status')}</p>
								<div className="flex items-center gap-1.5">
									{detail.installed ? (
										<>
											<CheckCircleIcon
												width={16}
												height={16}
												className="shrink-0 text-[color-mix(in_srgb,rgb(16_185_129)_62%,var(--desktop-text-secondary))]"
												aria-hidden
											/>
											<span className="font-medium text-(--desktop-text-primary)">
												{t('installed')}
											</span>
										</>
									) : (
										<span className="font-medium text-(--desktop-text-primary)">
											{t('notInstalled')}
										</span>
									)}
								</div>
							</div>
						</div>
					</div>
				</details>
			) : null}
		</>
	);
}
