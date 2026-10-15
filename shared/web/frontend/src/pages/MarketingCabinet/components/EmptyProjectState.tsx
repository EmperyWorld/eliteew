import { RectangleStackIcon } from '@heroicons/react/24/outline';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { DesktopAppEmptyState } from '../../Desktop/components/DesktopAppChrome';

interface EmptyProjectStateProps {
	title: string;
	description: string;
}

export function EmptyProjectState({
	title,
	description,
}: EmptyProjectStateProps) {
	return (
		<DesktopAppEmptyState
			title={
				<span className="block text-base font-semibold tracking-tight text-(--desktop-text-primary)">
					{title}
				</span>
			}
			description={
				<span className="mx-auto block max-w-sm text-sm leading-relaxed text-(--desktop-text-secondary)">
					{description}
				</span>
			}
			icon={
				<RectangleStackIcon
					className="h-8 w-8 text-[rgb(var(--desktop-accent-rgb))]/75"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			}
			className="min-h-[360px] gap-5"
		/>
	);
}
