import * as React from 'react';

const CALENDAR_SKELETON_CARD_KEYS = [
	'ccs-card-a',
	'ccs-card-b',
	'ccs-card-c',
	'ccs-card-d',
] as const;
const CALENDAR_SKELETON_ROW_KEYS = [
	'ccs-row-a',
	'ccs-row-b',
	'ccs-row-c',
] as const;

export const CalendarSkeleton: React.FC = () => {
	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
			{CALENDAR_SKELETON_CARD_KEYS.map((cardKey, idx) => (
				<div
					key={cardKey}
					className="rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 shadow-sm overflow-hidden animate-pulse"
					style={{ animationDelay: `${idx * 80}ms` }}
				>
					<div className="px-5 py-4 flex items-center justify-between border-b border-neutral-100 dark:border-slate-700">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-xl bg-neutral-200 dark:bg-slate-700" />
							<div className="space-y-2">
								<div className="h-4 w-32 bg-neutral-200 dark:bg-slate-700 rounded" />
								<div className="h-3 w-24 bg-neutral-200 dark:bg-slate-700 rounded" />
							</div>
						</div>
						<div className="h-8 w-20 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
					</div>
					<div className="px-5 py-3 flex gap-2 flex-wrap">
						<div className="h-6 w-24 bg-neutral-200 dark:bg-slate-700 rounded-full" />
						<div className="h-6 w-28 bg-neutral-200 dark:bg-slate-700 rounded-full" />
					</div>
					<div className="divide-y divide-neutral-100 dark:divide-slate-700">
						{CALENDAR_SKELETON_ROW_KEYS.map((rowKey) => (
							<div key={rowKey} className="p-4 flex gap-3 items-start">
								<div className="w-10 h-10 rounded-xl bg-neutral-200 dark:bg-slate-700" />
								<div className="flex-1 space-y-2">
									<div className="h-4 w-40 bg-neutral-200 dark:bg-slate-700 rounded" />
									<div className="h-3 w-28 bg-neutral-200 dark:bg-slate-700 rounded" />
									<div className="h-3 w-32 bg-neutral-200 dark:bg-slate-700 rounded" />
								</div>
								<div className="h-6 w-16 bg-neutral-200 dark:bg-slate-700 rounded" />
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
};
