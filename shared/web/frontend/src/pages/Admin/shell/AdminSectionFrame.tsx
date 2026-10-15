/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared content width and padding for admin sections that use a simple page layout.
 *
 * Invariants:
 * - Does not render a duplicate title when shell header mode is `full` (pass title only for placeholders).
 *
 * Related:
 * - `pages/Admin/AdminPlaceholderSection.tsx`
 * - `pages/Admin/UnifiedAdminPage.tsx`
 */

import * as React from 'react';
import { cn } from '@/utils/cn';

interface AdminSectionFrameProps {
	children: React.ReactNode;
	/** Wider layout for dense tables (Users uses its own shell). */
	variant?: 'default' | 'wide' | 'full';
	className?: string;
}

const WIDTH: Record<NonNullable<AdminSectionFrameProps['variant']>, string> = {
	default: 'max-w-4xl',
	wide: 'max-w-[100rem]',
	full: 'max-w-none',
};

export function AdminSectionFrame({
	children,
	variant = 'default',
	className,
}: AdminSectionFrameProps): React.ReactElement {
	return (
		<div
			className={cn(
				'mx-auto w-full px-4 py-6 sm:px-6 lg:px-8',
				WIDTH[variant],
				className
			)}
		>
			{children}
		</div>
	);
}
