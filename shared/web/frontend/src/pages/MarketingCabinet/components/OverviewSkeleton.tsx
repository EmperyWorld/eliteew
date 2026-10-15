import { DesktopAppSkeleton } from '../../Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

/** Скелетон загрузки обзора проекта — повторяет ритм дашборда (тулбар, метрики, панели). */
export function OverviewSkeleton() {
	return (
		<div className="grid min-w-0 gap-4">
			{/* View mode toolbar */}
			<DesktopAppSkeleton className="h-[4.75rem] w-full rounded-(--desktop-radius-lg)" />
			{/* Metric row — six tiles on xl, как в OverviewView */}
			<div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
				{(
					[
						['metric-a', 0],
						['metric-b', 1],
						['metric-c', 2],
						['metric-d', 0],
						['metric-e', 1],
						['metric-f', 2],
					] as const
				).map(([id, rhythm]) => (
					<DesktopAppSkeleton
						key={id}
						className={cn(
							'h-24 rounded-(--desktop-radius)',
							rhythm === 1 && 'xl:h-[5.5rem]',
							rhythm === 2 && 'xl:h-[5.25rem]'
						)}
					/>
				))}
			</div>
			{/* Action center + coverage / freshness */}
			<div className="grid min-w-0 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
				<DesktopAppSkeleton className="min-h-[17rem] rounded-(--desktop-radius-lg) xl:min-h-[18rem]" />
				<DesktopAppSkeleton className="min-h-[15rem] rounded-(--desktop-radius-lg) xl:min-h-[17rem]" />
			</div>
			{/* Strategy block */}
			<DesktopAppSkeleton className="min-h-[12rem] w-full rounded-(--desktop-radius-lg)" />
			{/* Activity + AI */}
			<div className="grid min-w-0 gap-3 xl:grid-cols-2">
				<DesktopAppSkeleton className="min-h-[11rem] rounded-(--desktop-radius-lg)" />
				<DesktopAppSkeleton className="min-h-[13rem] rounded-(--desktop-radius-lg)" />
			</div>
			{/* Bottom triad */}
			<div className="grid min-w-0 gap-3 xl:grid-cols-3">
				<DesktopAppSkeleton className="min-h-[10.5rem] rounded-(--desktop-radius-lg)" />
				<DesktopAppSkeleton className="min-h-[11.5rem] rounded-(--desktop-radius-lg)" />
				<DesktopAppSkeleton className="min-h-[10rem] rounded-(--desktop-radius-lg)" />
			</div>
		</div>
	);
}
