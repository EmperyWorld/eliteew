import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';

export interface BreadcrumbItem {
	label: string;
	onClick?: () => void;
}

interface BreadcrumbsProps {
	items: BreadcrumbItem[];
	className?: string;
}

const crumbLabelClass =
	'block min-w-0 max-w-[min(11rem,42vw)] truncate text-left sm:max-w-[13rem]';

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
	if (items.length === 0) return null;

	return (
		<nav
			aria-label="Хлебные крошки"
			className={`min-w-0 max-w-full ${className}`.trim()}
		>
			<ol className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 text-inherit leading-none">
				{items.map((item, index) => (
					<li
						key={items
							.slice(0, index + 1)
							.map((crumb) => crumb.label)
							.join('/')}
						className="flex min-w-0 max-w-full items-center gap-1"
					>
						{index > 0 && (
							<ChevronRightIcon
								className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-dim)"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						)}
						{item.onClick ? (
							<button
								type="button"
								onClick={item.onClick}
								title={item.label}
								className={`rounded px-1.5 py-0.5 text-(--desktop-text-secondary) transition-colors hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary) ${crumbLabelClass}`}
							>
								{item.label}
							</button>
						) : (
							<span
								className={`text-(--desktop-text-primary) ${crumbLabelClass}`}
								title={item.label}
							>
								{item.label}
							</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}
