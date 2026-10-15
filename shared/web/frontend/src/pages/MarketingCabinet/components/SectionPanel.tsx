/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Section chrome for Marketing Hall views — title, optional help, actions, body.
 *
 * Invariants:
 * - `helpBlockId` must match `MarketingCabinet/help/blocks.*.json` keys when set.
 *
 * Related:
 * - `BlockHelpButton.tsx`, `useMarketingShellClasses.ts`
 */

import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import { BlockHelpButton } from './BlockHelpButton';
import { cn } from '@/utils/cn';

interface SectionPanelProps {
	title: string;
	description?: string;
	/** Ключ справки из `MarketingCabinet/help/blocks.*.json` */
	helpBlockId?: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}

export function SectionPanel({
	title,
	description,
	helpBlockId,
	actions,
	children,
	className,
}: SectionPanelProps) {
	const { contentPanel } = useMarketingShellClasses();
	return (
		<div
			className={cn(
				'relative flex flex-col gap-4 border border-white/5 p-4 shadow-(--mc-section-panel-shadow) backdrop-blur-md lg:p-5',
				contentPanel,
				className
			)}
		>
			{helpBlockId ? (
				<div className="absolute left-2 top-2 z-2">
					<BlockHelpButton blockId={helpBlockId} />
				</div>
			) : null}
			<div
				className={cn(
					'flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-3.5',
					helpBlockId && 'pl-10 pt-0.5'
				)}
			>
				<div className="min-w-0 flex-1 space-y-1.5">
					<div className="flex items-center gap-2">
						<span
							className="h-px w-8 shrink-0 bg-[linear-gradient(90deg,rgba(212,175,106,0.45),transparent)] opacity-90"
							aria-hidden
						/>
						<h3
							className={cn(
								'mc-display-title text-base font-medium leading-snug tracking-wide text-(--desktop-text-primary)'
							)}
						>
							{title}
						</h3>
					</div>
					{description ? (
						<p className="mc-body-copy w-full max-w-none text-sm leading-6 tracking-wide text-(--desktop-text-secondary)">
							{description}
						</p>
					) : null}
				</div>
				{actions}
			</div>
			{children}
		</div>
	);
}
