import * as React from 'react';

const BOOKINGS_STAT_KEYS = [
	'bks-stat-a',
	'bks-stat-b',
	'bks-stat-c',
	'bks-stat-d',
] as const;
const BOOKINGS_ROW_KEYS = ['bks-row-a', 'bks-row-b', 'bks-row-c'] as const;

export const BookingsSkeleton: React.FC = () => {
	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-pulse">
				<div className="space-y-2 flex-1">
					<div className="h-9 w-56 max-w-full bg-neutral-200 dark:bg-slate-700 rounded-xl" />
					<div className="h-4 w-full max-w-md bg-neutral-200 dark:bg-slate-700 rounded" />
				</div>
				<div className="flex gap-2 shrink-0">
					<div className="h-10 w-36 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
					<div className="h-10 w-28 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
				</div>
			</div>
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{BOOKINGS_STAT_KEYS.map((k) => (
					<div
						key={k}
						className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse min-h-[96px]"
					>
						<div className="h-4 w-20 bg-neutral-200 dark:bg-slate-700 rounded mb-2" />
						<div className="h-7 w-16 bg-neutral-200 dark:bg-slate-700 rounded" />
					</div>
				))}
			</div>

			<div className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse min-h-[120px]">
				<div className="flex flex-col lg:flex-row gap-4">
					<div className="h-11 w-full bg-neutral-200 dark:bg-slate-700 rounded-lg" />
					<div className="h-11 w-32 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
					<div className="h-11 w-60 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
				</div>
			</div>

			{BOOKINGS_ROW_KEYS.map((k, i) => (
				<div
					key={k}
					className="p-5 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse"
					style={{ animationDelay: `${i * 100}ms` }}
				>
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="w-12 h-12 rounded-xl bg-neutral-200 dark:bg-slate-700" />
							<div className="space-y-2">
								<div className="h-4 w-32 bg-neutral-200 dark:bg-slate-700 rounded" />
								<div className="h-4 w-24 bg-neutral-200 dark:bg-slate-700 rounded" />
							</div>
						</div>
						<div className="h-6 w-20 bg-neutral-200 dark:bg-slate-700 rounded-full" />
					</div>
					<div className="mt-4 grid grid-cols-3 gap-3">
						<div className="h-4 w-full bg-neutral-200 dark:bg-slate-700 rounded" />
						<div className="h-4 w-full bg-neutral-200 dark:bg-slate-700 rounded" />
						<div className="h-4 w-full bg-neutral-200 dark:bg-slate-700 rounded" />
					</div>
				</div>
			))}
		</div>
	);
};
