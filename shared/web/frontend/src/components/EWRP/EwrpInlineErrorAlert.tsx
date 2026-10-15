/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared inline error alert for EWRP status column, history modal, doc picker.
 *
 * Invariants:
 * - Always `role="alert"` with icon; long messages use expandable clamped text.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`
 */

import { cn } from '@/utils/cn';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	ExclamationCircleIcon,
	ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { EwrpExpandableClampedText } from './EwrpExpandableClampedText';
import { ewrpClampedTextNeedsExpand } from './ewrpExpandableClampedText';

const sw = DESKTOP_LUCIDE.stroke;

export type EwrpInlineErrorAlertProps = {
	message: string;
	className?: string;
	children?: ReactNode;
	retryLabel?: string;
	onRetry?: () => void;
	retryLoading?: boolean;
	retryButtonClassName?: string;
};

export function EwrpInlineErrorAlert({
	message,
	className,
	children,
	retryLabel,
	onRetry,
	retryLoading = false,
	retryButtonClassName,
}: EwrpInlineErrorAlertProps) {
	return (
		<div
			className={cn(
				'flex flex-col gap-3 rounded-xl border border-red-500/35 bg-red-950/25 px-4 py-3 text-sm text-red-200/95',
				className
			)}
			role="alert"
		>
			<div className="flex gap-2.5">
				<ExclamationCircleIcon
					className="mt-0.5 h-4 w-4 shrink-0 text-red-300"
					strokeWidth={sw}
					aria-hidden
				/>
				<div className="min-w-0 flex-1 leading-relaxed">
					{ewrpClampedTextNeedsExpand(message) ? (
						<EwrpExpandableClampedText text={message} tone="error" embedded />
					) : (
						message
					)}
					{children}
				</div>
			</div>
			{onRetry && retryLabel ? (
				<button
					type="button"
					onClick={onRetry}
					disabled={retryLoading}
					className={cn(
						'self-start inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-[11px] font-medium text-red-100/95 transition-colors hover:bg-red-950/60',
						retryLoading && 'pointer-events-none opacity-60',
						retryButtonClassName
					)}
				>
					{retryLoading ? (
						<ArrowPathIcon
							className="h-3.5 w-3.5 shrink-0 animate-spin"
							strokeWidth={sw}
							aria-hidden
						/>
					) : null}
					{retryLabel}
				</button>
			) : null}
		</div>
	);
}
