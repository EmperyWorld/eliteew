/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dedicated chrome for non-chat output surface modes (builder, edit, roadmap).
 *
 * Invariants:
 * - Sticky header + scroll body; optional sticky footer for primary actions.
 * - Panels with titles expose a named region; visible headers use real headings.
 *
 * Related:
 * - CompanionOutputSurface.tsx
 */

import { type ReactNode, useId } from 'react';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

type Props = {
	title: string;
	subtitle?: string;
	onBack: () => void;
	backLabel: string;
	children: ReactNode;
	footer?: ReactNode;
	headerActions?: ReactNode;
	testId?: string;
	hideHeader?: boolean;
	/** When true, body fills remaining height and defers scroll to inner panes (document editor). */
	fillBody?: boolean;
};

export function CompanionSurfacePanel({
	title,
	subtitle,
	onBack,
	backLabel,
	children,
	footer,
	headerActions,
	testId,
	hideHeader = false,
	fillBody = false,
}: Props) {
	const hasHeading = Boolean(title || subtitle);
	const headingId = useId();
	const subtitleId = useId();
	const regionProps = title
		? hideHeader
			? { role: 'region' as const, 'aria-label': title }
			: {
					role: 'region' as const,
					'aria-labelledby': headingId,
					...(subtitle ? { 'aria-describedby': subtitleId } : {}),
				}
		: {};

	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-testid={testId}
			{...regionProps}
		>
			{hideHeader ? null : (
				<div
					className={cn(
						'sticky top-0 z-10 -mx-3 -mt-3 mb-3 flex shrink-0 flex-wrap items-start justify-between gap-2',
						'border-b border-(--companion-divider)/70 bg-(--companion-bg)/95 px-3 py-2.5 backdrop-blur-sm'
					)}
				>
					{hasHeading ? (
						<div className="min-w-0">
							{title ? (
								<h2
									id={headingId}
									className="text-[14px] font-semibold text-(--desktop-text-primary)"
								>
									{title}
								</h2>
							) : null}
							{subtitle ? (
								<p
									id={subtitleId}
									className="mt-0.5 text-[11px] text-(--companion-text-soft)"
								>
									{subtitle}
								</p>
							) : null}
						</div>
					) : (
						<span aria-hidden className="min-w-0 flex-1" />
					)}
					<div className="flex shrink-0 items-center gap-1.5">
						{headerActions}
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="shrink-0"
							onClick={onBack}
						>
							{backLabel}
						</DesktopAppButton>
					</div>
				</div>
			)}
			<div
				className={cn(
					'min-h-0 flex-1',
					fillBody
						? 'flex flex-col overflow-hidden'
						: 'overflow-y-auto overscroll-y-contain'
				)}
			>
				{children}
			</div>
			{footer ? (
				<div
					className={cn(
						'sticky bottom-0 -mx-3 -mb-3 mt-3 shrink-0',
						'border-t border-(--companion-divider)/70 bg-(--companion-bg)/95 px-3 py-2 backdrop-blur-sm'
					)}
				>
					{footer}
				</div>
			) : null}
		</div>
	);
}
