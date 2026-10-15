/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UI constants and chrome tokens for CommentsReviewPanel submodules.
 *
 * Invariants:
 * - Virtual list thresholds match FileManagerPanel conventions.
 *
 * Related:
 * - CommentsReviewComposer.tsx, CommentsReviewThreadList.tsx
 */

import {
	CheckIcon,
	EyeIcon,
	PencilSquareIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

import { DESKTOP_APP_STYLE_CONTRACT } from '@/pages/Desktop/components/DesktopAppChrome';

import type { ReviewStatus } from '@/components/UltimateDocEditor/types/editor.types';

export const REVIEW_STATUS_UI: Array<{
	value: ReviewStatus;
	icon: typeof PencilSquareIcon;
	activeClassName: string;
}> = [
	{
		value: 'draft',
		icon: PencilSquareIcon,
		activeClassName: 'border-slate-400/30 bg-slate-500/20 text-slate-200',
	},
	{
		value: 'in_review',
		icon: EyeIcon,
		activeClassName: 'border-blue-400/30 bg-blue-500/20 text-blue-200',
	},
	{
		value: 'approved',
		icon: CheckIcon,
		activeClassName: 'border-green-400/30 bg-green-500/20 text-green-200',
	},
	{
		value: 'rejected',
		icon: XCircleIcon,
		activeClassName: 'border-red-400/30 bg-red-500/20 text-red-200',
	},
	{
		value: 'changes_requested',
		icon: PencilSquareIcon,
		activeClassName: 'border-orange-400/30 bg-orange-500/20 text-orange-200',
	},
];

export const DESKTOP_DOC_INPUT_CHROME = cn(
	DESKTOP_APP_STYLE_CONTRACT.searchField,
	'focus:border-(--desktop-border-strong) focus:bg-(--desktop-surface-soft-hover)',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
);

/** Virtualized thread list threshold (matches FileManagerPanel pattern). */
export const COMMENT_THREAD_VIRTUAL_MIN = 12;
export const ESTIMATE_THREAD_BASE_PX = 160;
export const ESTIMATE_THREAD_COMMENT_PX = 68;
export const ESTIMATE_THREAD_SELECTION_PX = 80;
export const ESTIMATE_THREAD_REPLY_OPEN_PX = 100;
