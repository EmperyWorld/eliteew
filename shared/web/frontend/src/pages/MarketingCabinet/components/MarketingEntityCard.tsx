import type { HTMLAttributes } from 'react';

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import { BlockHelpButton } from './BlockHelpButton';

export type MarketingEntityCardProps = HTMLAttributes<HTMLDivElement> & {
	/** Справка раздела (тот же ключ, что у родительского SectionPanel). */
	helpBlockId?: string;
};

/** Верхняя строка карточки: заголовок + действия, плотная сетка и перенос. */
export function MarketingEntityCardHead({
	className,
	...rest
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				'flex min-w-0 flex-wrap items-start justify-between gap-x-2 gap-y-1',
				className
			)}
			{...rest}
		/>
	);
}

/** Компактная строка метаданных (категория, дата, счётчики). */
export function MarketingEntityCardMeta({
	className,
	...rest
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				DESKTOP_TYPOGRAPHY.caption,
				'leading-snug tracking-[0.01em]',
				'[&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-(--desktop-text-dim)',
				className
			)}
			{...rest}
		/>
	);
}

/** Карточка сущности: справка (i) — в левом верхнем углу; контент с отступом слева. */
export function MarketingEntityCard({
	helpBlockId,
	className,
	children,
	...rest
}: MarketingEntityCardProps) {
	const { contentPanel } = useMarketingShellClasses();
	return (
		<div
			className={cn(
				'group relative isolate',
				contentPanel,
				'transition-[border-color,background-color] duration-200 ease-out motion-reduce:transition-none',
				'hover:border-(--desktop-border-strong)/80 hover:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_96%,var(--desktop-surface-panel)_4%)]',
				'focus-within:border-(--desktop-border-strong)/90',
				className
			)}
			{...rest}
		>
			{helpBlockId ? (
				<div className="absolute left-1.5 top-1.5 z-2">
					<BlockHelpButton blockId={helpBlockId} compact />
				</div>
			) : null}
			<div
				className={cn(
					'min-w-0 rounded-[inherit]',
					'transition-shadow duration-200 ease-out motion-reduce:transition-none',
					'focus-within:shadow-[inset_0_0_0_2px_rgb(var(--desktop-accent-rgb)/0.38)]',
					helpBlockId && 'pl-8'
				)}
			>
				{children}
			</div>
		</div>
	);
}

MarketingEntityCard.Head = MarketingEntityCardHead;
MarketingEntityCard.Meta = MarketingEntityCardMeta;
