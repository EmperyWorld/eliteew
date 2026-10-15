import { cn } from '@/utils/cn';
import { CpuChipIcon } from '@heroicons/react/24/outline';

/** Внутренний системный аккаунт (GAF и т.п.). */
export function SystemAccountBadge({
	className,
	title = 'Системный аккаунт',
}: {
	className?: string;
	title?: string;
}) {
	return (
		<span
			title={title}
			className={cn(
				'inline-flex shrink-0 items-center gap-0.5 text-amber-500 dark:text-amber-400',
				className
			)}
			aria-label={title}
			role="img"
		>
			<CpuChipIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
		</span>
	);
}
