import { cn } from '@/utils/cn';
import { CheckBadgeIcon } from '@heroicons/react/24/outline';

/** Admin-granted «доверенный пользователь» — рядом с аватаром/ником в профиле и GAF. */
export function TrustedUserBadge({
	className,
	title = 'Доверенный пользователь',
}: {
	className?: string;
	/** @default Доверенный пользователь */
	title?: string;
}) {
	return (
		<span
			title={title}
			className={cn(
				'inline-flex shrink-0 items-center text-sky-500 dark:text-sky-400',
				className
			)}
			aria-label={title}
			role="img"
		>
			<CheckBadgeIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
		</span>
	);
}
