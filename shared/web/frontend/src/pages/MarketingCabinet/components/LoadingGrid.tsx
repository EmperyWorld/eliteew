import { DesktopAppSkeleton } from '../../Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

const skeletonLine =
	'h-3 rounded-md bg-(--desktop-border-subtle)/45 motion-reduce:opacity-90';

function LoadingGridCard({ className }: { className?: string }) {
	return (
		<DesktopAppSkeleton
			className={cn(
				'flex h-64 flex-col gap-4 rounded-(--desktop-radius-lg) p-5',
				className
			)}
			role="presentation"
		>
			<div className="h-4 w-[42%] rounded-md bg-(--desktop-border-subtle)/45 motion-reduce:opacity-90" />
			<div className="space-y-2">
				<div className={cn('w-full', skeletonLine)} />
				<div className={cn('w-[88%]', skeletonLine)} />
				<div className={cn('w-[64%]', skeletonLine)} />
			</div>
			<div className="mt-auto min-h-18 flex-1 rounded-(--desktop-radius) bg-(--desktop-border-subtle)/35 motion-reduce:opacity-90" />
		</DesktopAppSkeleton>
	);
}

export function LoadingGrid() {
	return (
		<div
			className="grid grid-cols-1 gap-4 lg:grid-cols-2"
			role="status"
			aria-busy="true"
			aria-live="polite"
			aria-label="Загрузка"
		>
			<LoadingGridCard />
			<LoadingGridCard />
			<LoadingGridCard className="lg:col-span-2" />
		</div>
	);
}
