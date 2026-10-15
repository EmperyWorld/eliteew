import * as React from 'react';

const STAT_PLACEHOLDER_KEYS = [
	'stat-a',
	'stat-b',
	'stat-c',
	'stat-d',
	'stat-e',
	'stat-f',
] as const;
const ORDER_PLACEHOLDER_KEYS = [
	'ord-a',
	'ord-b',
	'ord-c',
	'ord-d',
	'ord-e',
] as const;

/** Layout mirrors OrdersPage: header row, 6 stats, filter bar, list min-height — reduces CLS after load. */
export const OrdersSkeleton: React.FC = () => {
	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
				<div className="space-y-3 flex-1">
					<div className="h-6 w-40 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
					<div className="h-10 w-64 max-w-full bg-neutral-200 dark:bg-slate-700 rounded-xl" />
					<div className="h-4 w-full max-w-xl bg-neutral-200 dark:bg-slate-700 rounded" />
					<div className="flex flex-wrap gap-2">
						<div className="h-6 w-24 bg-neutral-200 dark:bg-slate-700 rounded-full" />
						<div className="h-6 w-28 bg-neutral-200 dark:bg-slate-700 rounded-full" />
					</div>
				</div>
				<div className="h-10 w-32 bg-neutral-200 dark:bg-slate-700 rounded-xl shrink-0" />
			</div>

			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
				{STAT_PLACEHOLDER_KEYS.map((id) => (
					<div
						key={id}
						className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 animate-pulse min-h-[104px]"
					>
						<div className="h-4 w-20 bg-neutral-200 dark:bg-slate-700 rounded mb-2" />
						<div className="h-8 w-16 bg-neutral-200 dark:bg-slate-700 rounded" />
					</div>
				))}
			</div>

			<div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 animate-pulse min-h-[88px]">
				<div className="flex flex-col lg:flex-row gap-4 items-stretch">
					<div className="h-11 flex-1 bg-neutral-200 dark:bg-slate-700 rounded-xl" />
					<div className="h-11 w-full lg:w-44 bg-neutral-200 dark:bg-slate-700 rounded-xl" />
					<div className="h-11 w-24 bg-neutral-200 dark:bg-slate-700 rounded-xl ml-auto" />
				</div>
			</div>

			<div className="min-h-[min(70vh,920px)] space-y-3">
				{ORDER_PLACEHOLDER_KEYS.map((id, i) => (
					<div
						key={id}
						className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 animate-pulse min-h-[148px]"
						style={{ animationDelay: `${i * 100}ms` }}
					>
						<div className="flex items-start justify-between">
							<div className="flex items-start gap-4">
								<div className="w-12 h-12 rounded-xl bg-neutral-200 dark:bg-slate-700 shrink-0" />
								<div className="space-y-2">
									<div className="h-5 w-32 bg-neutral-200 dark:bg-slate-700 rounded" />
									<div className="h-4 w-48 bg-neutral-200 dark:bg-slate-700 rounded" />
									<div className="h-4 w-24 bg-neutral-200 dark:bg-slate-700 rounded" />
								</div>
							</div>
							<div className="space-y-2 text-right">
								<div className="h-6 w-20 bg-neutral-200 dark:bg-slate-700 rounded-full ml-auto" />
								<div className="h-6 w-24 bg-neutral-200 dark:bg-slate-700 rounded ml-auto" />
							</div>
						</div>
						<div className="mt-4 pt-4 border-t border-neutral-100 dark:border-slate-700 flex gap-2">
							<div className="h-4 w-32 bg-neutral-200 dark:bg-slate-700 rounded" />
							<div className="h-4 w-24 bg-neutral-200 dark:bg-slate-700 rounded" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
};
