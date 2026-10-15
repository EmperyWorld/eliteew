/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bordered content panel for admin subsections (System blocks, filters, etc.).
 *
 * Invariants:
 * - Section titles use caption scale, not page-level h1/h2 (shell header owns those).
 *
 * Related:
 * - `shell/eliteewAdminShell.css`
 * - `shell/AdminSectionFrame.tsx`
 */

import * as React from 'react';
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

interface AdminSectionPanelProps {
	children: React.ReactNode;
	/** Subsection title (not duplicated in shell `full` header). */
	title?: string;
	titleId?: string;
	description?: React.ReactNode;
	actions?: React.ReactNode;
	className?: string;
	/** Top margin between stacked panels; first panel should use `none`. */
	spacing?: 'default' | 'none';
}

export function AdminSectionPanel({
	children,
	title,
	titleId,
	description,
	actions,
	className,
	spacing = 'default',
}: AdminSectionPanelProps): React.ReactElement {
	return (
		<section
			className={cn(
				'eliteew-admin-panel',
				spacing === 'default' && 'mt-8 first:mt-0',
				className
			)}
			aria-labelledby={title && titleId ? titleId : undefined}
		>
			{title || actions ? (
				<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
					{title ? (
						<div className="min-w-0">
							<h3
								id={titleId}
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'text-violet-200/90 normal-case tracking-wide'
								)}
							>
								{title}
							</h3>
							{description ? (
								<div
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'mt-1.5 max-w-3xl text-slate-400'
									)}
								>
									{description}
								</div>
							) : null}
						</div>
					) : (
						description
					)}
					{actions ? (
						<div className="flex shrink-0 flex-wrap items-center gap-2">
							{actions}
						</div>
					) : null}
				</div>
			) : null}
			{children}
		</section>
	);
}
