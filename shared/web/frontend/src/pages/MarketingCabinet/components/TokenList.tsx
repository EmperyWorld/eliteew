import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

interface TokenListProps {
	items: string[];
	emptyText: string;
}

export function TokenList({ items, emptyText }: TokenListProps) {
	if (items.length === 0) {
		return (
			<p className={cn('py-0.5', DESKTOP_TYPOGRAPHY.small, 'leading-relaxed')}>
				{emptyText}
			</p>
		);
	}

	return (
		<ul className="m-0 flex list-none flex-wrap gap-2 p-0">
			{items.map((item) => (
				<li key={item} className="max-w-full">
					<span className="inline-flex max-w-full items-center rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1.5 text-xs leading-snug text-(--desktop-text-secondary) shadow-sm transition-[border-color,background-color,box-shadow] hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-panel)">
						<span className="min-w-0 wrap-break-word">{item}</span>
					</span>
				</li>
			))}
		</ul>
	);
}
