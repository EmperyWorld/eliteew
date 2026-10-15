/**
 * RetryBlock - Reusable "Повторить попытку" block for load/API errors
 * Use in widgets, windows, and editor surfaces when an operation failed and user can retry.
 */

import * as React from 'react';
import {
	ArrowPathIcon,
	ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
export interface RetryBlockProps {
	message?: string;
	onRetry: () => void;
	retryLabel?: string;
	className?: string;
}

export const RetryBlock: React.FC<RetryBlockProps> = ({
	message = 'Не удалось загрузить. Попробуйте ещё раз.',
	onRetry,
	retryLabel = 'Повторить',
	className = '',
}) => (
	<div
		className={`flex flex-col items-center justify-center p-6 text-center rounded-xl ${className}`}
		style={{
			backgroundColor: 'var(--color-slate-800)',
			borderWidth: '1px',
			borderStyle: 'solid',
			borderColor: 'var(--glass-border)',
		}}
		role="alert"
	>
		<ExclamationCircleIcon
			className="w-10 h-10 text-red-400/80 mb-3"
			aria-hidden
		/>
		<p className="text-sm mb-4" style={{ color: 'var(--color-slate-300)' }}>
			{message}
		</p>
		<button
			type="button"
			onClick={onRetry}
			className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-sm text-white transition-colors"
		>
			<ArrowPathIcon width={14} height={14} />
			{retryLabel}
		</button>
	</div>
);
