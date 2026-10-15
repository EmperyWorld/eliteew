import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import { BlockHelpButton } from './BlockHelpButton';

interface MetricCardProps {
	label: string;
	value: React.ReactNode;
	/** Short scale hint, e.g. «Индекс 0–100» vs «Количество объектов». */
	metricKind?: React.ReactNode;
	hint?: React.ReactNode;
	helpBlockId?: string;
	tone?: 'default' | 'accent' | 'danger';
}

export function MetricCard({
	label,
	value,
	metricKind,
	hint,
	helpBlockId,
	tone = 'default',
}: MetricCardProps) {
	const { contentPanel } = useMarketingShellClasses();
	const toneClass =
		tone === 'accent'
			? 'border-(--mc-accent-28) bg-(--desktop-surface-accent)'
			: tone === 'danger'
				? 'border-red-500/28 bg-red-950/25'
				: '';

	return (
		<div
			className={cn(
				'relative flex min-h-[108px] flex-col justify-between gap-4 p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] lg:p-5',
				contentPanel,
				toneClass
			)}
		>
			{helpBlockId ? (
				<div className="absolute left-2 top-2 z-2">
					<BlockHelpButton blockId={helpBlockId} compact />
				</div>
			) : null}
			<div className={cn('space-y-1.5', helpBlockId && 'pl-10 pt-0.5')}>
				<div className="flex items-center gap-2">
					<span
						className="h-px w-6 shrink-0 rounded-full bg-[linear-gradient(90deg,var(--mc-accent),transparent)] opacity-80"
						aria-hidden
					/>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'min-h-4 flex-1 pr-1 font-medium uppercase tracking-[0.18em]'
						)}
					>
						{label}
					</p>
				</div>
				{metricKind ? (
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'text-(--desktop-text-secondary)'
						)}
					>
						{metricKind}
					</p>
				) : null}
				<div className="text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.03em] text-(--desktop-text-primary)">
					{value}
				</div>
			</div>
			{hint ? (
				<div
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'w-full max-w-none text-sm leading-6',
						helpBlockId && 'pl-10'
					)}
				>
					{hint}
				</div>
			) : null}
		</div>
	);
}
