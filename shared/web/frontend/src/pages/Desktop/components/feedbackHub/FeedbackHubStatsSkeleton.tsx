/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Placeholder quota summary cards while Feedback Hub summary query is loading.
 *
 * Invariants:
 * - Matches live stats grid layout (single column on embedded mobile).
 *
 * Related:
 * - FeedbackHubStatsSection.tsx · FeedbackHubApp.tsx · FEEDBACK-HUB.md
 */
import * as React from 'react';
import { cn } from '@/utils/cn';
import { DesktopAppSurface } from '../DesktopAppChrome';

export type FeedbackHubStatsSkeletonProps = {
	embeddedMobileLayout: boolean;
};

export function FeedbackHubStatsSkeleton({
	embeddedMobileLayout,
}: FeedbackHubStatsSkeletonProps): React.ReactElement {
	return (
		<div
			className={cn(
				'grid grid-cols-1 gap-2',
				!embeddedMobileLayout && 'sm:grid-cols-3'
			)}
			aria-busy="true"
			aria-hidden="true"
			data-feedback-hub-guide="stats"
		>
			{[0, 1, 2].map((slot) => (
				<DesktopAppSurface
					key={slot}
					variant="soft"
					padding="sm"
					className="min-w-0 motion-safe:animate-pulse motion-reduce:animate-none"
				>
					<div className="flex items-start gap-3">
						<div className="h-9 w-9 shrink-0 rounded-(--desktop-radius) bg-(--desktop-surface-soft)" />
						<div className="min-w-0 flex-1 space-y-2">
							<div className="h-3 w-24 rounded bg-(--desktop-surface-soft)" />
							<div className="h-6 w-20 rounded bg-(--desktop-surface-soft)/90" />
							<div className="h-3 w-full max-w-[180px] rounded bg-(--desktop-surface-soft)/80" />
						</div>
					</div>
				</DesktopAppSurface>
			))}
		</div>
	);
}
